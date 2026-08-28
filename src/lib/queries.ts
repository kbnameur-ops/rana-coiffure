import "server-only";
import { getSql } from "./db";
import type {
  Booking,
  Category,
  Closure,
  OpeningHour,
  Service,
  Settings,
  Staff,
  StaffHour,
} from "./types";

/* ---------------------------------------------------------------- settings */

export async function getSettings(): Promise<Settings> {
  const sql = await getSql();
  const rows = await sql.query<{ key: string; value: string }>(
    "SELECT key, value FROM settings",
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSettings(values: Record<string, string>) {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      await tx.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [key, value],
      );
    }
  });
}

export function settingInt(settings: Settings, key: string, fallback: number) {
  const n = Number.parseInt(settings[key] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

/* -------------------------------------------------------------- catalogue */

export async function getCategories(): Promise<Category[]> {
  const sql = await getSql();
  return sql.query<Category>(
    "SELECT * FROM categories ORDER BY sort_order, id",
  );
}

export async function getServices(onlyActive = false): Promise<Service[]> {
  const sql = await getSql();
  return sql.query<Service>(
    `SELECT * FROM services ${onlyActive ? "WHERE active" : ""} ORDER BY sort_order, id`,
  );
}

export async function getService(id: number): Promise<Service | undefined> {
  const sql = await getSql();
  const [row] = await sql.query<Service>(
    "SELECT * FROM services WHERE id = $1",
    [id],
  );
  return row;
}

/**
 * Plusieurs prestations d'un coup, rendues dans l'ordre demandé : c'est celui
 * que la cliente a choisi, et donc celui du récapitulatif. Un identifiant
 * inconnu est simplement absent du résultat, à l'appelant de le constater.
 */
export async function getServicesByIds(ids: number[]): Promise<Service[]> {
  const uniques = [...new Set(ids)].filter((id) => Number.isInteger(id));
  if (uniques.length === 0) return [];
  const sql = await getSql();
  const rows = await sql.query<Service>(
    "SELECT * FROM services WHERE id = ANY($1)",
    [uniques],
  );
  return uniques
    .map((id) => rows.find((s) => s.id === id))
    .filter((s): s is Service => s !== undefined);
}

export async function getCatalogue(onlyActive = false) {
  const [categories, services] = await Promise.all([
    getCategories(),
    getServices(onlyActive),
  ]);
  const grouped = categories.map((category) => ({
    category,
    services: services.filter((s) => s.category_id === category.id),
  }));
  const orphans = services.filter(
    (s) =>
      s.category_id === null || !categories.some((c) => c.id === s.category_id),
  );
  if (orphans.length) {
    grouped.push({
      category: { id: 0, name: "Autres prestations", sort_order: 999, image: "" },
      services: orphans,
    });
  }
  return grouped.filter((g) => g.services.length > 0);
}

/* ------------------------------------------------------------------ horaires */

export async function getOpeningHours(): Promise<OpeningHour[]> {
  const sql = await getSql();
  return sql.query<OpeningHour>(
    "SELECT * FROM opening_hours ORDER BY weekday, open_min",
  );
}

export async function replaceOpeningHours(rows: Omit<OpeningHour, "id">[]) {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    await tx.query("DELETE FROM opening_hours");
    for (const r of rows) {
      await tx.query(
        "INSERT INTO opening_hours (weekday, open_min, close_min) VALUES ($1, $2, $3)",
        [r.weekday, r.open_min, r.close_min],
      );
    }
  });
}

export async function getClosures(fromDate?: string): Promise<Closure[]> {
  const sql = await getSql();
  return fromDate
    ? sql.query<Closure>(
        "SELECT * FROM closures WHERE date >= $1 ORDER BY date",
        [fromDate],
      )
    : sql.query<Closure>("SELECT * FROM closures ORDER BY date");
}

export async function addClosure(date: string, reason: string) {
  const sql = await getSql();
  await sql.query(
    "INSERT INTO closures (date, reason) VALUES ($1, $2) ON CONFLICT (date) DO UPDATE SET reason = EXCLUDED.reason",
    [date, reason],
  );
}

export async function deleteClosure(id: number) {
  const sql = await getSql();
  await sql.query("DELETE FROM closures WHERE id = $1", [id]);
}

/* ---------------------------------------------------------------- bookings */

export async function listBookings(opts: {
  from?: string;
  to?: string;
  status?: string;
  search?: string;
}): Promise<Booking[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const next = () => `$${params.length + 1}`;

  if (opts.from) {
    clauses.push(`date >= ${next()}`);
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push(`date <= ${next()}`);
    params.push(opts.to);
  }
  if (opts.status && opts.status !== "all") {
    clauses.push(`status = ${next()}`);
    params.push(opts.status);
  }
  if (opts.search) {
    const like = `%${opts.search}%`;
    const a = next();
    params.push(like);
    const b = next();
    params.push(like);
    const c = next();
    params.push(like);
    clauses.push(
      `(customer_name ILIKE ${a} OR phone ILIKE ${b} OR ref ILIKE ${c})`,
    );
  }

  const sql = await getSql();
  return sql.query<Booking>(
    `SELECT * FROM bookings ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY date, start_min`,
    params,
  );
}

export async function setBookingStatus(id: number, status: string) {
  const sql = await getSql();
  await sql.query("UPDATE bookings SET status = $1 WHERE id = $2", [
    status,
    id,
  ]);
}

export async function deleteBooking(id: number) {
  const sql = await getSql();
  await sql.query("DELETE FROM bookings WHERE id = $1", [id]);
}

/* ------------------------------------------------------------------ équipe */

export async function getStaff(onlyActive = false): Promise<Staff[]> {
  const sql = await getSql();
  return sql.query<Staff>(
    `SELECT * FROM staff ${onlyActive ? "WHERE active" : ""} ORDER BY sort_order, id`,
  );
}

export async function getStaffHours(): Promise<StaffHour[]> {
  const sql = await getSql();
  return sql.query<StaffHour>(
    "SELECT * FROM staff_hours ORDER BY staff_id, weekday, open_min",
  );
}

/** `staff_id` → prestations assurées. Un ensemble vide signifie « toutes ». */
export async function getStaffSkills(): Promise<Map<number, Set<number>>> {
  const sql = await getSql();
  const rows = await sql.query<{ staff_id: number; service_id: number }>(
    "SELECT staff_id, service_id FROM staff_services",
  );
  const map = new Map<number, Set<number>>();
  for (const r of rows) {
    const set = map.get(r.staff_id) ?? new Set<number>();
    set.add(r.service_id);
    map.set(r.staff_id, set);
  }
  return map;
}

export async function createStaff(name: string, roleLabel: string) {
  const sql = await getSql();
  await sql.query(
    `INSERT INTO staff (name, role_label, sort_order)
     VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM staff))`,
    [name, roleLabel],
  );
}

export async function updateStaff(
  id: number,
  name: string,
  roleLabel: string,
  active: boolean,
) {
  const sql = await getSql();
  await sql.query(
    "UPDATE staff SET name = $1, role_label = $2, active = $3 WHERE id = $4",
    [name, roleLabel, active, id],
  );
}

export async function deleteStaff(id: number) {
  const sql = await getSql();
  await sql.query("DELETE FROM staff WHERE id = $1", [id]);
}

export async function replaceStaffHours(
  staffId: number,
  rows: { weekday: number; open_min: number; close_min: number }[],
) {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    await tx.query("DELETE FROM staff_hours WHERE staff_id = $1", [staffId]);
    for (const r of rows)
      await tx.query(
        "INSERT INTO staff_hours (staff_id, weekday, open_min, close_min) VALUES ($1, $2, $3, $4)",
        [staffId, r.weekday, r.open_min, r.close_min],
      );
  });
}

export async function replaceStaffSkills(staffId: number, serviceIds: number[]) {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    await tx.query("DELETE FROM staff_services WHERE staff_id = $1", [staffId]);
    for (const serviceId of serviceIds)
      await tx.query(
        "INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [staffId, serviceId],
      );
  });
}

/** Un espace salon sans compte administrateur est inaccessible. */
export async function hasAdminAccount(): Promise<boolean> {
  const sql = await getSql();
  const [row] = await sql.query<{ n: string }>(
    "SELECT COUNT(*) AS n FROM admin_users",
  );
  return Number(row.n) > 0;
}
