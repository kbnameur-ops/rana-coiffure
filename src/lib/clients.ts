import "server-only";
import { getSql, type Sql } from "./db";
import { normalisePhone } from "./phone";
import { settingInt } from "./queries";
import { nowMinutes, todayISO } from "./time";
import type { Booking, Settings } from "./types";

export type Client = {
  id: number;
  phone: string;
  email: string;
  name: string;
  birthdate: string;
  failed_logins: number;
  locked_until: string;
  created_at: string;
};

/** Bornes de la limitation de tentatives sur l'espace client. */
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type LoyaltyState = {
  enabled: boolean;
  threshold: number;
  reward: string;
  /** Passages honorés depuis toujours. */
  honoured: number;
  /** Récompenses déjà remises par le salon. */
  redeemed: number;
  /** Récompenses acquises et pas encore remises. */
  available: number;
  /** Tampons sur la carte en cours, de 0 à `threshold`. */
  stamps: number;
};

/** Crée ou met à jour la fiche client au moment d'une réservation. */
export async function upsertClient(
  tx: Sql,
  input: { phone: string; name: string; email: string; birthdate?: string },
): Promise<number | null> {
  const key = normalisePhone(input.phone);
  if (!key) return null;

  const [row] = await tx.query<{ id: number }>(
    `INSERT INTO clients (phone, email, name, birthdate, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (phone) DO UPDATE SET
       name      = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE clients.name END,
       email     = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE clients.email END,
       birthdate = CASE WHEN EXCLUDED.birthdate <> '' THEN EXCLUDED.birthdate ELSE clients.birthdate END
     RETURNING id`,
    [
      key,
      input.email.trim().toLowerCase(),
      input.name.trim(),
      (input.birthdate ?? "").trim(),
      new Date().toISOString(),
    ],
  );
  return row?.id ?? null;
}

export type ClientLogin =
  | { ok: true; clientId: number }
  | { ok: false; reason: "identifiants" | "bloque"; minutes?: number };

/**
 * Connexion à l'espace client : téléphone normalisé + date de naissance.
 * Une date de naissance n'est pas un secret — elle se devine en quelques
 * dizaines de milliers d'essais — d'où le blocage temporaire au bout de
 * plusieurs échecs.
 */
export async function authenticateClient(
  phone: string,
  birthdate: string,
): Promise<ClientLogin> {
  const key = normalisePhone(phone);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate))
    return { ok: false, reason: "identifiants" };

  const sql = await getSql();
  const [client] = await sql.query<Client>(
    "SELECT * FROM clients WHERE phone = $1",
    [key],
  );
  if (!client) return { ok: false, reason: "identifiants" };

  const now = Date.now();
  if (client.locked_until && Date.parse(client.locked_until) > now)
    return {
      ok: false,
      reason: "bloque",
      minutes: Math.max(
        1,
        Math.ceil((Date.parse(client.locked_until) - now) / 60_000),
      ),
    };

  if (!client.birthdate || client.birthdate !== birthdate) {
    const attempts = client.failed_logins + 1;
    const locked =
      attempts >= MAX_ATTEMPTS
        ? new Date(now + LOCK_MINUTES * 60_000).toISOString()
        : "";
    await sql.query(
      "UPDATE clients SET failed_logins = $1, locked_until = $2 WHERE id = $3",
      [locked ? 0 : attempts, locked, client.id],
    );
    return locked
      ? { ok: false, reason: "bloque", minutes: LOCK_MINUTES }
      : { ok: false, reason: "identifiants" };
  }

  await sql.query(
    "UPDATE clients SET failed_logins = 0, locked_until = '' WHERE id = $1",
    [client.id],
  );
  return { ok: true, clientId: client.id };
}

export async function setClientBirthdate(clientId: number, birthdate: string) {
  const sql = await getSql();
  await sql.query(
    "UPDATE clients SET birthdate = $1, failed_logins = 0, locked_until = '' WHERE id = $2",
    [birthdate, clientId],
  );
}

export async function getClientById(id: number): Promise<Client | undefined> {
  const sql = await getSql();
  const [row] = await sql.query<Client>("SELECT * FROM clients WHERE id = $1", [id]);
  return row;
}

/**
 * Recherche par e-mail pour l'envoi du lien de connexion. Si plusieurs fiches
 * partagent l'adresse, on retient celle qui a le plus de rendez-vous.
 */
export async function findClientByEmail(email: string): Promise<Client | undefined> {
  const sql = await getSql();
  const [row] = await sql.query<Client>(
    `SELECT c.* FROM clients c
      LEFT JOIN bookings b ON b.client_id = c.id
      WHERE lower(c.email) = lower($1) AND c.email <> ''
      GROUP BY c.id
      ORDER BY COUNT(b.id) DESC, c.id DESC
      LIMIT 1`,
    [email.trim()],
  );
  return row;
}

export async function getClientBookings(clientId: number): Promise<Booking[]> {
  const sql = await getSql();
  return sql.query<Booking>(
    "SELECT * FROM bookings WHERE client_id = $1 ORDER BY date DESC, start_min DESC",
    [clientId],
  );
}

/**
 * Bascule en « manquée » les rendez-vous confirmés dont l'heure est passée
 * depuis plus que le délai de grâce : le salon garde le temps de les pointer,
 * mais un rendez-vous oublié ne reste pas confirmé indéfiniment.
 */
export async function sweepNoShows(): Promise<number> {
  const sql = await getSql();
  const settings = await getSettingsRaw(sql);
  const grace = Math.max(0, settingInt(settings, "no_show_grace_hours", 12));

  const cutoff = new Date();
  cutoff.setUTCMinutes(cutoff.getUTCMinutes() - grace * 60);
  // Le balayage raisonne dans le fuseau du salon comme le reste du planning.
  const date = todayISO(cutoff);
  const minutes = nowMinutes(cutoff);

  const rows = await sql.query<{ id: number }>(
    `UPDATE bookings SET status = 'no_show'
      WHERE status = 'confirmed'
        AND (date < $1 OR (date = $1 AND end_min <= $2))
      RETURNING id`,
    [date, minutes],
  );
  return rows.length;
}

async function getSettingsRaw(sql: Sql): Promise<Settings> {
  const rows = await sql.query<{ key: string; value: string }>(
    "SELECT key, value FROM settings",
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getLoyalty(
  clientId: number,
  settings: Settings,
): Promise<LoyaltyState> {
  const sql = await getSql();
  const threshold = Math.max(1, settingInt(settings, "loyalty_threshold", 10));

  const [counts] = await sql.query<{ honoured: string; redeemed: string }>(
    `SELECT
       (SELECT COUNT(*) FROM bookings WHERE client_id = $1 AND status = 'done') AS honoured,
       (SELECT COUNT(*) FROM loyalty_redemptions WHERE client_id = $1) AS redeemed`,
    [clientId],
  );

  const honoured = Number(counts?.honoured ?? 0);
  const redeemed = Number(counts?.redeemed ?? 0);
  const earned = Math.floor(honoured / threshold);
  const available = Math.max(0, earned - redeemed);
  const stamps = available > 0 ? threshold : honoured % threshold;

  return {
    enabled: settings.loyalty_enabled !== "0",
    threshold,
    reward: settings.loyalty_reward || "Une prestation offerte",
    honoured,
    redeemed,
    available,
    stamps,
  };
}

export async function redeemLoyalty(clientId: number, note: string) {
  const sql = await getSql();
  await sql.query(
    "INSERT INTO loyalty_redemptions (client_id, created_at, note) VALUES ($1, $2, $3)",
    [clientId, new Date().toISOString(), note.slice(0, 200)],
  );
}

export type ClientRow = Client & {
  honoured: number;
  missed: number;
  cancelled: number;
  upcoming: number;
  last_visit: string | null;
  redeemed: number;
};

export async function listClients(search = ""): Promise<ClientRow[]> {
  const sql = await getSql();
  const like = `%${search.trim()}%`;
  return sql.query<ClientRow>(
    `SELECT c.*,
       COUNT(*) FILTER (WHERE b.status = 'done')      AS honoured,
       COUNT(*) FILTER (WHERE b.status = 'no_show')   AS missed,
       COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled,
       COUNT(*) FILTER (WHERE b.status = 'confirmed') AS upcoming,
       MAX(b.date) FILTER (WHERE b.status = 'done')   AS last_visit,
       (SELECT COUNT(*) FROM loyalty_redemptions r WHERE r.client_id = c.id) AS redeemed
     FROM clients c
     LEFT JOIN bookings b ON b.client_id = c.id
     WHERE ($1 = '%%' OR c.name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1)
     GROUP BY c.id
     ORDER BY MAX(b.date) DESC NULLS LAST, c.id DESC`,
    [like],
  );
}

/**
 * Effacement à la demande : la fiche disparaît, les rendez-vous restent au
 * planning du salon mais sont anonymisés.
 */
export async function deleteClientData(clientId: number) {
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    await tx.query(
      `UPDATE bookings
          SET customer_name = 'Client supprimé', phone = '', email = '',
              notes = '', client_id = NULL
        WHERE client_id = $1`,
      [clientId],
    );
    await tx.query("DELETE FROM clients WHERE id = $1", [clientId]);
  });
}
