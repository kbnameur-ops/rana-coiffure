import "server-only";
import { getSql, type Sql } from "./db";
import { settingInt } from "./queries";
import { upsertClient } from "./clients";
import { addDays, isoWeekday } from "./format";
import { nowMinutes, todayISO } from "./time";
import type {
  Booking,
  Closure,
  OpeningHour,
  Settings,
  Staff,
  StaffHour,
} from "./types";

export type DayAvailability = {
  date: string;
  open: boolean;
  reason?: string;
  slots: number[]; // minutes depuis minuit
};

type Range = { open_min: number; close_min: number };

type Context = {
  settings: Settings;
  capacity: number;
  step: number;
  minNotice: number;
  maxAdvance: number;
  hours: OpeningHour[];
  closures: Map<string, string>;
  bookings: Map<string, Booking[]>;
  staff: Staff[];
  staffHours: Map<number, StaffHour[]>;
  skills: Map<number, Set<number>>;
  today: string;
};

/**
 * Charge en une passe tout ce qui conditionne les créneaux de la période,
 * plutôt qu'une rafale de requêtes par jour affiché.
 */
async function loadContext(
  sql: Sql,
  from: string,
  to: string,
): Promise<Context> {
  // Toutes les lectures passent par `sql` : à l'intérieur d'une transaction,
  // emprunter une autre connexion bloquerait jusqu'à sa clôture.
  const [settingRows, hours, closures, bookings, staff, staffHourRows, skillRows] =
    await Promise.all([
      sql.query<{ key: string; value: string }>("SELECT key, value FROM settings"),
      sql.query<OpeningHour>(
        "SELECT * FROM opening_hours ORDER BY weekday, open_min",
      ),
      sql.query<Closure>(
        "SELECT * FROM closures WHERE date >= $1 AND date <= $2",
        [from, to],
      ),
      sql.query<Booking>(
        `SELECT * FROM bookings
          WHERE date >= $1 AND date <= $2 AND status <> 'cancelled'
          ORDER BY start_min`,
        [from, to],
      ),
      sql.query<Staff>("SELECT * FROM staff WHERE active ORDER BY sort_order, id"),
      sql.query<StaffHour>("SELECT * FROM staff_hours ORDER BY weekday, open_min"),
      sql.query<{ staff_id: number; service_id: number }>(
        "SELECT staff_id, service_id FROM staff_services",
      ),
    ]);

  const settings: Settings = Object.fromEntries(
    settingRows.map((r) => [r.key, r.value]),
  );

  const byDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    const list = byDate.get(b.date) ?? [];
    list.push(b);
    byDate.set(b.date, list);
  }

  const staffHours = new Map<number, StaffHour[]>();
  for (const h of staffHourRows) {
    const list = staffHours.get(h.staff_id) ?? [];
    list.push(h);
    staffHours.set(h.staff_id, list);
  }

  const skills = new Map<number, Set<number>>();
  for (const r of skillRows) {
    const set = skills.get(r.staff_id) ?? new Set<number>();
    set.add(r.service_id);
    skills.set(r.staff_id, set);
  }

  return {
    settings,
    capacity: Math.max(1, settingInt(settings, "capacity", 2)),
    step: Math.max(5, settingInt(settings, "slot_step_min", 15)),
    minNotice: settingInt(settings, "min_notice_hours", 2) * 60,
    maxAdvance: settingInt(settings, "max_advance_days", 45),
    hours,
    closures: new Map(closures.map((c) => [c.date, c.reason])),
    bookings: byDate,
    staff,
    staffHours,
    skills,
    today: todayISO(),
  };
}

/**
 * Un coiffeur sans compétence déclarée assure toutes les prestations. Sinon,
 * il doit couvrir *toutes* celles du rendez-vous : un rendez-vous cumulé est
 * assuré d'un bout à l'autre par la même personne.
 */
function canServe(context: Context, staffId: number, serviceIds: number[]) {
  const set = context.skills.get(staffId);
  if (!set || set.size === 0) return true;
  return serviceIds.every((id) => set.has(id));
}

/**
 * Plages travaillées par un coiffeur ce jour-là. Sans planning enregistré,
 * il suit les horaires d'ouverture du salon.
 */
function staffRanges(
  context: Context,
  staffId: number,
  weekday: number,
): Range[] {
  const planning = context.staffHours.get(staffId);
  if (!planning || planning.length === 0)
    return context.hours.filter((h) => h.weekday === weekday);
  return planning.filter((h) => h.weekday === weekday);
}

/**
 * Concurrence maximale des rendez-vous sur l'intervalle [from, to).
 * Les fauteuils étant interchangeables, un créneau est plaçable dès que
 * cette concurrence reste strictement inférieure à la capacité.
 */
function peakOverlap(bookings: Booking[], from: number, to: number): number {
  let peak = 0;
  for (let m = from; m < to; m++) {
    let n = 0;
    for (const b of bookings) if (b.start_min <= m && m < b.end_min) n++;
    if (n > peak) peak = n;
  }
  return peak;
}

function slotsInRanges(
  ranges: Range[],
  step: number,
  durationMin: number,
  earliest: number,
  isFree: (start: number, end: number) => boolean,
): number[] {
  const slots: number[] = [];
  for (const range of ranges) {
    const first = Math.ceil(range.open_min / step) * step;
    for (let t = first; t + durationMin <= range.close_min; t += step) {
      if (t < earliest) continue;
      if (!isFree(t, t + durationMin)) continue;
      slots.push(t);
    }
  }
  return slots;
}

export type DayQuery = {
  date: string;
  /** Durée cumulée des prestations : c'est elle qui occupe le créneau. */
  durationMin: number;
  serviceIds: number[];
  /** `null` = sans préférence : n'importe quel coiffeur qualifié. */
  staffId: number | null;
};

function computeDay(context: Context, query: DayQuery): DayAvailability {
  const { date, durationMin, serviceIds, staffId } = query;

  if (date < context.today)
    return { date, open: false, reason: "Date passée", slots: [] };

  if (date > addDays(context.today, context.maxAdvance))
    return {
      date,
      open: false,
      reason: "Réservations pas encore ouvertes à cette date",
      slots: [],
    };

  const closure = context.closures.get(date);
  if (closure !== undefined)
    return { date, open: false, reason: closure || "Salon fermé", slots: [] };

  const weekday = isoWeekday(date);
  const booked = context.bookings.get(date) ?? [];
  const earliest =
    date === context.today
      ? nowMinutes() + context.minNotice
      : Number.NEGATIVE_INFINITY;

  const qualified = context.staff.filter((s) => canServe(context, s.id, serviceIds));

  /* --- aucun coiffeur configuré : le salon fonctionne au nombre de fauteuils */
  if (qualified.length === 0) {
    const ranges = context.hours.filter((h) => h.weekday === weekday);
    if (ranges.length === 0)
      return { date, open: false, reason: "Salon fermé ce jour", slots: [] };
    const slots = slotsInRanges(
      ranges,
      context.step,
      durationMin,
      earliest,
      (from, to) => peakOverlap(booked, from, to) < context.capacity,
    );
    return { date, open: true, slots: [...new Set(slots)].sort((a, b) => a - b) };
  }

  /* --- avec équipe : chaque coiffeur est une ressource, planning à l'appui */
  const wanted =
    staffId === null ? qualified : qualified.filter((s) => s.id === staffId);
  if (wanted.length === 0)
    return {
      date,
      open: false,
      reason: "Ce coiffeur n'assure pas cette prestation",
      slots: [],
    };

  // Un rendez-vous sans coiffeur assigné (pris avant la mise en place de
  // l'équipe) occupe malgré tout un fauteuil.
  const chairs = context.staff.length;

  const slots = new Set<number>();
  let anyRange = false;

  for (const member of wanted) {
    const ranges = staffRanges(context, member.id, weekday);
    if (ranges.length === 0) continue;
    anyRange = true;
    const own = booked.filter((b) => b.staff_id === member.id);
    for (const slot of slotsInRanges(
      ranges,
      context.step,
      durationMin,
      earliest,
      (from, to) =>
        peakOverlap(own, from, to) === 0 &&
        peakOverlap(booked, from, to) < chairs,
    ))
      slots.add(slot);
  }

  if (!anyRange)
    return {
      date,
      open: false,
      reason:
        staffId === null ? "Salon fermé ce jour" : "Ce coiffeur ne travaille pas ce jour",
      slots: [],
    };

  return { date, open: true, slots: [...slots].sort((a, b) => a - b) };
}

/** Disponibilités sur `count` jours à partir de `start`. */
export async function getAvailabilityRange(
  start: string,
  count: number,
  query: Omit<DayQuery, "date">,
): Promise<DayAvailability[]> {
  const sql = await getSql();
  const dates = Array.from({ length: count }, (_, i) => addDays(start, i));
  const context = await loadContext(sql, dates[0], dates[dates.length - 1]);
  return dates.map((date) => computeDay(context, { ...query, date }));
}

function makeRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export type CreateBookingInput = {
  /** Une ou plusieurs prestations, dans l'ordre choisi par la cliente. */
  serviceIds: number[];
  staffId: number | null;
  date: string;
  startMin: number;
  customerName: string;
  phone: string;
  email?: string;
  birthdate?: string;
  notes?: string;
};

export type CreateBookingResult =
  | { ok: true; ref: string; staffName: string }
  /** `validation` : donnée saisie invalide. `conflict` : créneau plus libre. */
  | { ok: false; error: string; code: "validation" | "conflict" };

/**
 * Sans préférence exprimée, on retient le coiffeur qualifié disponible le
 * moins chargé ce jour-là : le planning de la journée reste équilibré.
 */
function pickStaff(
  context: Context,
  query: DayQuery,
  startMin: number,
): Staff | null {
  const weekday = isoWeekday(query.date);
  const booked = context.bookings.get(query.date) ?? [];
  const end = startMin + query.durationMin;

  const candidates = context.staff
    .filter((s) => canServe(context, s.id, query.serviceIds))
    .filter((s) => query.staffId === null || s.id === query.staffId)
    .filter((s) =>
      staffRanges(context, s.id, weekday).some(
        (r) => startMin >= r.open_min && end <= r.close_min,
      ),
    )
    .filter(
      (s) => peakOverlap(booked.filter((b) => b.staff_id === s.id), startMin, end) === 0,
    );

  if (candidates.length === 0) return null;

  const load = (id: number) =>
    booked
      .filter((b) => b.staff_id === id)
      .reduce((sum, b) => sum + (b.end_min - b.start_min), 0);

  return candidates.reduce((a, b) => (load(b.id) < load(a.id) ? b : a));
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const sql = await getSql();

  const ids = [...new Set(input.serviceIds)].filter((id) => Number.isFinite(id));
  if (ids.length === 0)
    return {
      ok: false,
      code: "validation",
      error: "Merci de choisir au moins une prestation.",
    };

  const trouvees = await sql.query<{
    id: number;
    name: string;
    price_cents: number;
    duration_min: number;
    active: boolean;
    bookable: boolean;
  }>("SELECT * FROM services WHERE id = ANY($1)", [ids]);

  // On respecte l'ordre de sélection : c'est celui du récapitulatif.
  const services = ids
    .map((id) => trouvees.find((s) => s.id === id))
    .filter((s): s is (typeof trouvees)[number] => Boolean(s));

  if (
    services.length !== ids.length ||
    services.some((s) => !s.active || !s.bookable)
  )
    return {
      ok: false,
      code: "validation",
      error: "Une des prestations choisies n'est plus réservable en ligne.",
    };

  const dureeTotale = services.reduce((t, s) => t + s.duration_min, 0);
  const prixTotal = services.reduce((t, s) => t + s.price_cents, 0);
  const libelle = services.map((s) => s.name).join(" + ");

  const name = input.customerName.trim();
  const phone = input.phone.trim();
  if (name.length < 2)
    return { ok: false, code: "validation", error: "Merci d'indiquer votre nom." };
  if (phone.replace(/[^0-9+]/g, "").length < 8)
    return {
      ok: false,
      code: "validation",
      error: "Merci d'indiquer un numéro de téléphone valide.",
    };
  const email = (input.email ?? "").trim();
  if (!email)
    return {
      ok: false,
      code: "validation",
      error: "Merci d'indiquer votre adresse e-mail.",
    };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return {
      ok: false,
      code: "validation",
      error: "L'adresse e-mail ne semble pas valide.",
    };

  // Le téléphone et la date de naissance ouvrent l'espace client : sans elle,
  // la cliente ne pourrait pas y retrouver le rendez-vous qu'elle vient de
  // prendre. Elle est donc demandée, pas proposée.
  const birthdate = (input.birthdate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate))
    return {
      ok: false,
      code: "validation",
      error: "Merci d'indiquer votre date de naissance.",
    };
  if (birthdate > todayISO())
    return {
      ok: false,
      code: "validation",
      error: "La date de naissance ne peut pas être dans le futur.",
    };

  try {
    return await sql.transaction(async (tx): Promise<CreateBookingResult> => {
      // Sérialise les réservations concurrentes : deux clients peuvent viser
      // le même créneau à la même seconde.
      await tx.query("LOCK TABLE bookings IN SHARE ROW EXCLUSIVE MODE");

      const context = await loadContext(tx, input.date, input.date);
      const query: DayQuery = {
        date: input.date,
        durationMin: dureeTotale,
        serviceIds: services.map((s) => s.id),
        staffId: input.staffId,
      };
      const day = computeDay(context, query);

      if (!day.open)
        return {
          ok: false,
          code: "conflict",
          error: day.reason ?? "Salon fermé",
        };
      if (!day.slots.includes(input.startMin))
        return {
          ok: false,
          code: "conflict",
          error: "Ce créneau vient d'être pris. Merci d'en choisir un autre.",
        };

      const assigned =
        context.staff.length > 0 ? pickStaff(context, query, input.startMin) : null;
      if (context.staff.length > 0 && !assigned)
        return {
          ok: false,
          code: "conflict",
          error: "Ce créneau vient d'être pris. Merci d'en choisir un autre.",
        };

      // La fiche client relie entre eux les rendez-vous d'une même personne :
      // sans elle, ni historique ni compteur de fidélité.
      const clientId = await upsertClient(tx, {
        phone,
        name,
        email,
        birthdate,
      });

      let ref = makeRef();
      for (let attempt = 0; attempt < 5; attempt++) {
        const taken = await tx.query("SELECT 1 FROM bookings WHERE ref = $1", [
          ref,
        ]);
        if (taken.length === 0) break;
        ref = makeRef();
      }

      // La ligne du rendez-vous porte le cumul : c'est lui qui occupe le
      // créneau, et tout ce qui lit déjà `bookings` continue de fonctionner.
      // `service_id` garde la première prestation, le détail suit juste après.
      const [booking] = await tx.query<{ id: number }>(
        `INSERT INTO bookings
           (ref, service_id, service_name, staff_id, staff_name, price_cents,
            duration_min, date, start_min, end_min, customer_name, phone,
            email, notes, client_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, 'confirmed', $16)
         RETURNING id`,
        [
          ref,
          services[0].id,
          libelle,
          assigned?.id ?? null,
          assigned?.name ?? "",
          prixTotal,
          dureeTotale,
          input.date,
          input.startMin,
          input.startMin + dureeTotale,
          name,
          phone,
          email,
          (input.notes ?? "").trim().slice(0, 500),
          clientId,
          new Date().toISOString(),
        ],
      );

      for (const [i, s] of services.entries()) {
        await tx.query(
          `INSERT INTO booking_services
             (booking_id, service_id, name, price_cents, duration_min, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [booking.id, s.id, s.name, s.price_cents, s.duration_min, i],
        );
      }

      return { ok: true, ref, staffName: assigned?.name ?? "" };
    });
  } catch {
    return {
      ok: false,
      code: "conflict",
      error: "Une erreur est survenue. Merci de réessayer.",
    };
  }
}
