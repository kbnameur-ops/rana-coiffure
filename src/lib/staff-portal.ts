import "server-only";
import bcrypt from "bcryptjs";
import { getSql } from "./db";
import { addDays } from "./format";
import { todayISO } from "./time";
import type { Booking, Staff } from "./types";

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type StaffLogin =
  | { ok: true; staffId: number }
  | { ok: false; reason: "identifiants" | "bloque" | "sans-code"; minutes?: number };

/** Connexion à l'espace coiffeur : le coiffeur se désigne et saisit son code. */
export async function authenticateStaff(
  staffId: number,
  code: string,
): Promise<StaffLogin> {
  const sql = await getSql();
  const [member] = await sql.query<Staff>(
    "SELECT * FROM staff WHERE id = $1 AND active",
    [staffId],
  );
  if (!member) return { ok: false, reason: "identifiants" };
  if (!member.access_code_hash) return { ok: false, reason: "sans-code" };

  const now = Date.now();
  if (member.locked_until && Date.parse(member.locked_until) > now)
    return {
      ok: false,
      reason: "bloque",
      minutes: Math.max(
        1,
        Math.ceil((Date.parse(member.locked_until) - now) / 60_000),
      ),
    };

  if (!bcrypt.compareSync(code, member.access_code_hash)) {
    const attempts = member.failed_logins + 1;
    const locked =
      attempts >= MAX_ATTEMPTS
        ? new Date(now + LOCK_MINUTES * 60_000).toISOString()
        : "";
    await sql.query(
      "UPDATE staff SET failed_logins = $1, locked_until = $2 WHERE id = $3",
      [locked ? 0 : attempts, locked, member.id],
    );
    return locked
      ? { ok: false, reason: "bloque", minutes: LOCK_MINUTES }
      : { ok: false, reason: "identifiants" };
  }

  await sql.query(
    "UPDATE staff SET failed_logins = 0, locked_until = '' WHERE id = $1",
    [member.id],
  );
  return { ok: true, staffId: member.id };
}

export async function setStaffCode(staffId: number, code: string) {
  const sql = await getSql();
  await sql.query(
    "UPDATE staff SET access_code_hash = $1, failed_logins = 0, locked_until = '' WHERE id = $2",
    [bcrypt.hashSync(code, 10), staffId],
  );
}

/** Code court, sans caractère prêtant à confusion à l'oral. */
export function makeAccessCode(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY34679";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function getStaffById(id: number): Promise<Staff | undefined> {
  const sql = await getSql();
  const [row] = await sql.query<Staff>("SELECT * FROM staff WHERE id = $1", [id]);
  return row;
}

/** Journée d'un coiffeur, prestations saisies comprises. */
export async function getStaffDay(
  staffId: number,
  date: string,
): Promise<Booking[]> {
  const sql = await getSql();
  return sql.query<Booking>(
    `SELECT * FROM bookings
      WHERE staff_id = $1 AND date = $2 AND status <> 'cancelled'
      ORDER BY start_min`,
    [staffId, date],
  );
}

export type WalkInInput = {
  staffId: number;
  serviceId: number;
  date: string;
  startMin: number;
  customerName: string;
  notes: string;
};

export type WalkInResult = { ok: true; ref: string } | { ok: false; error: string };

function makeRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/**
 * Prestation réalisée hors réservation, saisie par le coiffeur. Elle entre en
 * attente : c'est le salon qui la valide, et elle ne compte dans aucun total
 * avant cela.
 */
export async function addWalkIn(input: WalkInInput): Promise<WalkInResult> {
  const sql = await getSql();

  const [service] = await sql.query<{
    id: number;
    name: string;
    price_cents: number;
    duration_min: number;
  }>("SELECT * FROM services WHERE id = $1", [input.serviceId]);
  if (!service) return { ok: false, error: "Prestation inconnue." };

  const [member] = await sql.query<{ name: string }>(
    "SELECT name FROM staff WHERE id = $1",
    [input.staffId],
  );
  if (!member) return { ok: false, error: "Coiffeur inconnu." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { ok: false, error: "Date invalide." };
  if (input.date > todayISO())
    return { ok: false, error: "On ne saisit pas une prestation à venir." };
  if (input.date < addDays(todayISO(), -31))
    return { ok: false, error: "Trop ancien : prévenez le salon." };

  const ref = makeRef();
  const [booking] = await sql.query<{ id: number }>(
    `INSERT INTO bookings
       (ref, service_id, service_name, staff_id, staff_name, price_cents,
        duration_min, date, start_min, end_min, customer_name, phone, email,
        notes, status, source, created_by_staff_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '', '', $12,
             'pending', 'walk_in', $4, $13)
     RETURNING id`,
    [
      ref,
      service.id,
      service.name,
      input.staffId,
      member.name,
      service.price_cents,
      service.duration_min,
      input.date,
      input.startMin,
      input.startMin + service.duration_min,
      input.customerName.trim().slice(0, 120) || "Client de passage",
      input.notes.trim().slice(0, 300),
      new Date().toISOString(),
    ],
  );

  // Une saisie coiffeur ne porte qu'une prestation, mais elle rejoint le même
  // détail que les réservations en ligne : les cumuls lisent une seule table.
  await sql.query(
    `INSERT INTO booking_services
       (booking_id, service_id, name, price_cents, duration_min, sort_order)
     VALUES ($1, $2, $3, $4, $5, 0)`,
    [booking.id, service.id, service.name, service.price_cents, service.duration_min],
  );

  return { ok: true, ref };
}

export type ActivityLine = {
  service_name: string;
  count: number;
  total_cents: number;
};

export type Activity = {
  week: { from: string; to: string; lines: ActivityLine[]; count: number; total: number };
  month: { from: string; to: string; lines: ActivityLine[]; count: number; total: number };
  pending: number;
};

/** Lundi de la semaine contenant `date`. */
function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() === 0 ? 7 : dt.getUTCDay();
  return addDays(date, -(day - 1));
}

async function lines(
  staffId: number,
  from: string,
  to: string,
): Promise<ActivityLine[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    service_name: string;
    count: string;
    total_cents: string;
  }>(
    // Un rendez-vous cumulé compte pour chacune de ses prestations. Les
    // rendez-vous antérieurs au détail n'ont pas de ligne : le LEFT JOIN les
    // ramène sur leur libellé d'origine.
    `SELECT COALESCE(d.name, b.service_name) AS service_name,
            COUNT(*) AS count,
            SUM(COALESCE(d.price_cents, b.price_cents)) AS total_cents
       FROM bookings b
       LEFT JOIN booking_services d ON d.booking_id = b.id
      WHERE b.staff_id = $1 AND b.status = 'done'
        AND b.date >= $2 AND b.date <= $3
      GROUP BY COALESCE(d.name, b.service_name)
      ORDER BY COUNT(*) DESC, COALESCE(d.name, b.service_name)`,
    [staffId, from, to],
  );
  return rows.map((r) => ({
    service_name: r.service_name,
    count: Number(r.count),
    total_cents: Number(r.total_cents),
  }));
}

/** Cumuls d'un coiffeur : semaine en cours et mois en cours. */
export async function getActivity(
  staffId: number,
  reference = todayISO(),
): Promise<Activity> {
  const weekFrom = mondayOf(reference);
  const weekTo = addDays(weekFrom, 6);
  const monthFrom = `${reference.slice(0, 7)}-01`;
  const [y, m] = reference.split("-").map(Number);
  const monthTo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

  const sql = await getSql();
  const [weekLines, monthLines, pendingRows] = await Promise.all([
    lines(staffId, weekFrom, weekTo),
    lines(staffId, monthFrom, monthTo),
    sql.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM bookings WHERE staff_id = $1 AND status = 'pending'",
      [staffId],
    ),
  ]);

  const sum = (l: ActivityLine[]) => ({
    count: l.reduce((s, x) => s + x.count, 0),
    total: l.reduce((s, x) => s + x.total_cents, 0),
  });

  return {
    week: { from: weekFrom, to: weekTo, lines: weekLines, ...sum(weekLines) },
    month: { from: monthFrom, to: monthTo, lines: monthLines, ...sum(monthLines) },
    pending: Number(pendingRows[0]?.n ?? 0),
  };
}

/** Prestations saisies par les coiffeurs et pas encore tranchées. */
export async function getPendingWalkIns(): Promise<Booking[]> {
  const sql = await getSql();
  return sql.query<Booking>(
    "SELECT * FROM bookings WHERE status = 'pending' ORDER BY date DESC, start_min",
  );
}
