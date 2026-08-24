import "server-only";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { connectionString, isDevelopment } from "./config";
import { normalisePhone } from "./phone";

/**
 * Couche d'accès Postgres.
 *
 * - En production (`DATABASE_URL` défini) : Postgres hébergé via `pg`.
 * - En local, sans configuration : PGlite, un Postgres embarqué qui écrit
 *   dans `data/pgdata`. Même moteur, même SQL — aucune divergence de dialecte.
 */

export interface Sql {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
  /** Exécute un bloc SQL pouvant contenir plusieurs instructions. */
  exec(text: string): Promise<void>;
  /** Exécute `fn` dans une transaction. Pas d'imbrication. */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

/* --------------------------------------------------------- pilote hébergé */

async function createPoolSql(url: string): Promise<Sql> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    // Les hébergeurs Postgres gérés (Neon, Supabase…) imposent TLS mais
    // présentent un certificat que Node ne sait pas rattacher à une CA connue.
    ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
  });

  const sql: Sql = {
    async query(text, params) {
      const res = await pool.query(text, params);
      return res.rows;
    },
    async exec(text) {
      await pool.query(text);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const tx: Sql = {
          async query(text, params) {
            const res = await client.query(text, params);
            return res.rows;
          },
          async exec(text) {
            await client.query(text);
          },
          transaction() {
            throw new Error("Transactions imbriquées non supportées");
          },
        };
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
  return sql;
}

/* ----------------------------------------------------------- pilote local */

async function createPgliteSql(): Promise<Sql> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const client = await PGlite.create({ dataDir: path.join(dir, "pgdata") });

  const wrap = (c: {
    query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }>;
    exec: (t: string) => Promise<unknown>;
  }): Sql => ({
    async query(text, params) {
      const res = await c.query(text, params);
      return res.rows as never[];
    },
    async exec(text) {
      await c.exec(text);
    },
    transaction() {
      throw new Error("Transactions imbriquées non supportées");
    },
  });

  const root = wrap(client);
  return {
    query: root.query,
    exec: root.exec,
    transaction: (fn) =>
      client.transaction((tx) => fn(wrap(tx))) as never,
  };
}

/* ------------------------------------------------------------ singleton */

declare global {
  // Le rechargement à chaud recrée les modules : on garde une seule connexion.
  var __salonSql: Promise<Sql> | undefined;
}

export function getSql(): Promise<Sql> {
  if (!globalThis.__salonSql) {
    const url = connectionString();
    globalThis.__salonSql = (
      url ? createPoolSql(url) : createPgliteSql()
    ).then(async (sql) => {
      await initialise(sql);
      return sql;
    });
  }
  return globalThis.__salonSql;
}

/* ------------------------------------------------------ schéma et amorçage */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price_cents  INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 30,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  bookable     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS opening_hours (
  id        SERIAL PRIMARY KEY,
  weekday   INTEGER NOT NULL,
  open_min  INTEGER NOT NULL,
  close_min INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS closures (
  id     SERIAL PRIMARY KEY,
  date   TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bookings (
  id            SERIAL PRIMARY KEY,
  ref           TEXT NOT NULL UNIQUE,
  service_id    INTEGER REFERENCES services(id) ON DELETE SET NULL,
  service_name  TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,
  duration_min  INTEGER NOT NULL,
  date          TEXT NOT NULL,
  start_min     INTEGER NOT NULL,
  end_min       INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'confirmed',
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date, status);

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

-- Jetons de réinitialisation du mot de passe d'administration.
CREATE TABLE IF NOT EXISTS admin_tokens (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE IF NOT EXISTS staff (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  role_label TEXT NOT NULL DEFAULT '',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Planning hebdomadaire d'un coiffeur. Aucune ligne pour un coiffeur =
-- il suit les horaires d'ouverture du salon.
CREATE TABLE IF NOT EXISTS staff_hours (
  id        SERIAL PRIMARY KEY,
  staff_id  INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  weekday   INTEGER NOT NULL,
  open_min  INTEGER NOT NULL,
  close_min INTEGER NOT NULL
);

-- Compétences. Aucune ligne pour un coiffeur = il assure toutes les
-- prestations.
CREATE TABLE IF NOT EXISTS staff_services (
  staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);

-- Accès à l'espace coiffeur : un code remis par le salon, borné comme le
-- reste des identifiants du site.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS access_code_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS locked_until TEXT NOT NULL DEFAULT '';

-- source = online : pris par le client. source = walk_in : saisi par le
-- coiffeur après coup, en attente de validation par le salon.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'online';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_staff_id INTEGER
  REFERENCES staff(id) ON DELETE SET NULL;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS staff_id INTEGER
  REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS staff_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_bookings_staff ON bookings (staff_id, date);

-- Fiche client, indexée sur le téléphone normalisé : c'est lui qui relie
-- entre eux les rendez-vous d'une même personne.
CREATE TABLE IF NOT EXISTS clients (
  id         SERIAL PRIMARY KEY,
  phone      TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL DEFAULT '',
  name       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients (lower(email));

-- Identifiants de l'espace client : téléphone + date de naissance. Les deux
-- colonnes suivantes bornent les tentatives, une date de naissance étant
-- devinable par force brute sans cela.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthdate TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS locked_until TEXT NOT NULL DEFAULT '';

-- Jetons de connexion à usage unique envoyés par e-mail.
CREATE TABLE IF NOT EXISTS client_tokens (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- Récompenses de fidélité déjà remises, déduites du compteur.
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id         SERIAL PRIMARY KEY,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT ''
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_id INTEGER
  REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings (client_id, date);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  shop_name: "Rana Coiffure",
  tagline: "Salon de coiffure dames",
  about:
    "Un salon de quartier où l'on prend le temps : le diagnostic avant les ciseaux, la couleur pesée pour votre base, le coiffage travaillé jusqu'au dernier geste. On y vient pour la coupe du mois comme pour la couleur qu'on n'ose pas ailleurs.",
  address: "12 rue des Lilas",
  postal_code: "75020",
  city: "Paris",
  phone: "01 23 45 67 89",
  email: "",
  instagram: "",
  google_maps_url: "",
  client_space_enabled: "1",
  loyalty_enabled: "1",
  loyalty_threshold: "10",
  loyalty_reward: "Un brushing offert",
  no_show_grace_hours: "12",
  google_place_id: "",
  google_places_api_key: "",
  reviews_enabled: "1",
  capacity: "2",
  slot_step_min: "15",
  min_notice_hours: "2",
  max_advance_days: "45",
  booking_notice:
    "Merci de prévenir au moins 2 h à l'avance en cas d'empêchement.",
};

const CATALOGUE: [string, [string, string, number, number][]][] = [
  [
    "Coupe & coiffage",
    [
      ["Shampooing, coupe, brushing", "Diagnostic, shampooing, coupe aux ciseaux et brushing.", 4500, 60],
      ["Coupe seule", "Sur cheveux lavés, coupe et séchage naturel.", 3200, 45],
      ["Brushing", "Mise en forme à la brosse ronde, tenue longue durée.", 2800, 40],
      ["Coupe frange", "Rafraîchissement de la frange entre deux rendez-vous.", 1200, 15],
      ["Coupe enfant", "Jusqu'à 12 ans, shampooing compris.", 2200, 30],
      ["Boucles & ondulations", "Coiffage au fer ou au diffuseur selon la matière.", 3400, 45],
    ],
  ],
  [
    "Couleur & balayage",
    [
      ["Couleur racines", "Reprise de racines, patine de finition incluse.", 5200, 75],
      ["Couleur complète", "Couleur des racines aux pointes, longueurs comprises.", 6800, 90],
      ["Balayage", "Éclaircissement mèche à mèche pour un effet naturel.", 9500, 150],
      ["Ombré / tie and dye", "Dégradé de lumière sur les longueurs.", 11000, 180],
      ["Mèches papier", "Mèches fines et régulières sur toute la tête.", 8500, 135],
      ["Patine / gloss", "Rafraîchit le reflet et referme l'écaille.", 3800, 45],
    ],
  ],
  [
    "Lissage & permanente",
    [
      ["Lissage brésilien", "Discipline la matière pendant plusieurs mois.", 15000, 180],
      ["Lissage à la kératine", "Assouplit les frisottis, garde le mouvement.", 12000, 150],
      ["Permanente souple", "Volume et ondulations tenues au quotidien.", 8000, 120],
      ["Défrisage", "Sur cheveux crépus, avec soin de reconstruction.", 9000, 150],
    ],
  ],
  [
    "Soins & rituels",
    [
      ["Soin profond", "Masque au bac, massage du cuir chevelu, rinçage.", 2500, 25],
      ["Rituel botox capillaire", "Comble la fibre abîmée, densifie la longueur.", 5500, 60],
      ["Soin cuir chevelu", "Gommage et sérum apaisant, cheveux sensibles.", 3000, 35],
      ["Ampoule anti-chute", "Cure ciblée, appliquée en fin de prestation.", 1800, 15],
    ],
  ],
  [
    "Chignon & occasions",
    [
      ["Chignon de mariée", "Essai préalable, pose du jour, fixation tenue.", 12000, 120],
      ["Chignon de soirée", "Attache travaillée pour une occasion.", 6500, 75],
      ["Coiffure d'invitée", "Ondulations ou demi-attache, maquillage non inclus.", 4800, 60],
      ["Essai coiffure mariée", "Séance d'essai, photos et ajustements.", 6000, 90],
    ],
  ],
];

// Fermé dimanche et lundi. 9h30–19h en semaine, nocturne le jeudi jusqu'à 20h,
// 9h–18h30 le samedi.
const OPENING: [number, number, number][] = [
  [2, 570, 1140],
  [3, 570, 1140],
  [4, 570, 1200],
  [5, 570, 1140],
  [6, 540, 1110],
];

async function initialise(sql: Sql) {
  // Verrou consultatif : plusieurs instances peuvent démarrer en même temps
  // sur un hébergement sans serveur, une seule doit amorcer les données.
  await sql.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock($1)", [7241930]);
    await tx.exec(SCHEMA);

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await tx.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
        [key, value],
      );
    }

    const [{ n: categoryCount }] = await tx.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM categories",
    );
    if (Number(categoryCount) === 0) {
      for (const [index, [name, services]] of CATALOGUE.entries()) {
        const [category] = await tx.query<{ id: number }>(
          "INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id",
          [name, index],
        );
        for (const [
          i,
          [label, description, price, duration],
        ] of services.entries()) {
          await tx.query(
            `INSERT INTO services
               (category_id, name, description, price_cents, duration_min, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [category.id, label, description, price, duration, i],
          );
        }
      }
    }

    const [{ n: hourCount }] = await tx.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM opening_hours",
    );
    if (Number(hourCount) === 0) {
      for (const [weekday, open, close] of OPENING) {
        await tx.query(
          "INSERT INTO opening_hours (weekday, open_min, close_min) VALUES ($1, $2, $3)",
          [weekday, open, close],
        );
      }
    }

    // Rendez-vous antérieurs à la mise en place des fiches client : on les
    // rattache par téléphone, sans quoi l'historique repartirait de zéro.
    const orphans = await tx.query<{ phone: string; customer_name: string }>(
      `SELECT DISTINCT ON (phone) phone, customer_name
         FROM bookings WHERE client_id IS NULL AND phone <> ''
        ORDER BY phone, id DESC`,
    );
    for (const row of orphans) {
      const key = normalisePhone(row.phone);
      if (!key) continue;
      const [client] = await tx.query<{ id: number }>(
        `INSERT INTO clients (phone, name, created_at) VALUES ($1, $2, $3)
         ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
         RETURNING id`,
        [key, row.customer_name, new Date().toISOString()],
      );
      await tx.query(
        "UPDATE bookings SET client_id = $1 WHERE client_id IS NULL AND phone = $2",
        [client.id, row.phone],
      );
    }

    // Le compte d'administration est réconcilié à chaque démarrage tant que
    // `ADMIN_PASSWORD` est fournie : sans cela, une valeur corrigée après un
    // premier déploiement n'était jamais reprise et le salon restait dehors.
    const password =
      process.env.ADMIN_PASSWORD ?? (isDevelopment() ? "rana2026" : null);
    if (password) {
      const email = (process.env.ADMIN_EMAIL ?? "admin@salon.fr").toLowerCase();
      await tx.query(
        `INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [email, bcrypt.hashSync(password, 10)],
      );
      console.info(`[compte admin] mot de passe réappliqué pour ${email}`);
    }

    // Trace des comptes existants : une adresse inattendue ici explique à elle
    // seule un échec de connexion.
    const comptes = await tx.query<{ email: string }>(
      "SELECT email FROM admin_users ORDER BY id",
    );
    console.info(
      `[compte admin] adresses enregistrées : ${comptes.map((c) => c.email).join(", ") || "aucune"}`,
    );
  });
}
