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

-- Un rendez-vous peut cumuler plusieurs prestations : coupe et pose d'ongles
-- dans la même visite. La ligne du rendez-vous porte le total — c'est lui qui
-- occupe le créneau — et cette table en garde le détail.
CREATE TABLE IF NOT EXISTS booking_services (
  id           SERIAL PRIMARY KEY,
  booking_id   INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id   INTEGER REFERENCES services(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_booking_services ON booking_services (booking_id);

-- Illustration d'une catégorie, affichée sur la carte des prestations.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '';

-- Chaque prestation porte sa photo. Le visuel de la famille reste le repli
-- quand elle n'en a pas encore.
ALTER TABLE services ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '';

-- Certaines prestations n'ont pas de tarif ferme : la coiffure d'un mariage
-- dépend du travail demandé. Le prix devient alors un plancher, annoncé comme
-- tel plutôt que présenté comme un montant définitif.
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_from BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_id INTEGER
  REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings (client_id, date);
`;

export const DEFAULT_SETTINGS: Record<string, string> = {
  shop_name: "Rana Beauté Coiffure",
  tagline: "Salon de coiffure & institut de beauté",
  about:
    "Un salon de quartier où l'on prend le temps : le diagnostic avant les ciseaux, la couleur pesée pour votre base, le coiffage travaillé jusqu'au dernier geste. On y vient pour la coupe du mois comme pour la couleur qu'on n'ose pas ailleurs.",
  address: "84 avenue Jean Jaurès",
  postal_code: "93500",
  city: "Pantin",
  phone: "01 48 40 07 84",
  email: "",
  instagram: "https://www.instagram.com/rana_coiffure/",
  facebook: "https://www.facebook.com/share/19R7Scy2vj/",
  // Numéro au format international : c'est celui qu'attend un lien wa.me.
  whatsapp: "33699454556",
  google_maps_url: "https://share.google/UZgv6weBz2hVYYkpa",
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

/**
 * La carte du salon. Chaque ligne : nom, description, prix en centimes, durée
 * en minutes, et un drapeau « à partir de » pour les prestations dont le tarif
 * dépend du travail demandé.
 *
 * Les durées ne figuraient pas dans la carte fournie : elles sont estimées
 * pour que le créneau réservé tienne la prestation. C'est le salon qui les
 * ajuste depuis l'espace salon, à l'usage.
 */
type Ligne = [
  nom: string,
  description: string,
  prix: number,
  duree: number,
  photo: string,
  aPartirDe?: true,
];

const CATALOGUE: [string, Ligne[]][] = [
  [
    "Coiffure",
    [
      ["Shampooing + brushing cheveux courts", "Shampooing adapté, mise en forme à la brosse.", 2000, 30, "/photos/prestations/brushing-cheveux-courts.webp"],
      ["Shampooing + brushing cheveux mi-longs", "Shampooing adapté, brushing tenue longue durée.", 2500, 40, "/photos/prestations/brushing-cheveux-mi-longs.webp"],
      ["Shampooing + brushing cheveux longs", "Shampooing adapté, brushing sur toute la longueur.", 3000, 50, "/photos/prestations/brushing-cheveux-longs.webp"],
      ["Coupe + shampooing + coiffage", "Diagnostic, coupe aux ciseaux et coiffage.", 3500, 45, "/photos/prestations/coupe-pointes.webp"],
      ["Coupe + brushing", "Coupe travaillée et brushing de finition.", 4000, 60, "/photos/prestations/coupe-femme.webp"],
      ["Frange", "Rafraîchissement de la frange entre deux rendez-vous.", 800, 15, "/photos/prestations/coupe-frange.webp"],
      ["Coiffure / chignon simple", "Attache travaillée pour une sortie.", 4500, 45, "/photos/prestations/chignon-coiffure.webp"],
      ["Coiffure événementielle", "Mariage, soirée, cérémonie. Essai possible en amont.", 6000, 75, "/photos/prestations/coiffure-evenementielle.webp", true],
      ["Attache / coiffure rapide", "Queue travaillée, demi-attache ou tresse.", 3000, 30, "/photos/prestations/shampooing.webp"],
      ["Soin profond + massage cuir chevelu", "Masque au bac et massage du cuir chevelu.", 2500, 30, "/photos/prestations/massage-cuir-chevelu.webp"],
    ],
  ],
  [
    "Coloration & techniques",
    [
      ["Coloration racines", "Reprise de racines, patine de finition incluse.", 4500, 60, "/photos/prestations/coloration-racines.webp"],
      ["Coloration complète cheveux courts", "Des racines aux pointes, longueurs comprises.", 5500, 75, "/photos/prestations/coloration-complete.webp"],
      ["Coloration complète cheveux mi-longs", "Des racines aux pointes, longueurs comprises.", 6500, 90, "/photos/prestations/coloration-complete.webp"],
      ["Coloration complète cheveux longs", "Des racines aux pointes, longueurs comprises.", 7500, 105, "/photos/prestations/toner-patine-blonde.webp"],
      ["Patine / gloss", "Rafraîchit le reflet et referme l'écaille.", 3500, 30, "/photos/prestations/patine-gloss.webp"],
      ["Mèches cheveux courts", "Mèches fines et régulières, patine incluse.", 7500, 90, "/photos/prestations/meches.webp"],
      ["Mèches cheveux mi-longs", "Mèches fines et régulières, patine incluse.", 9500, 120, "/photos/prestations/meches.webp"],
      ["Mèches cheveux longs", "Mèches fines et régulières, patine incluse.", 11500, 150, "/photos/prestations/decoloration.webp"],
      ["Balayage cheveux courts", "Éclaircissement mèche à mèche, effet naturel.", 9000, 105, "/photos/prestations/balayage.webp"],
      ["Balayage cheveux mi-longs", "Éclaircissement mèche à mèche, effet naturel.", 12000, 135, "/photos/prestations/balayage.webp"],
      ["Balayage cheveux longs", "Éclaircissement mèche à mèche, effet naturel.", 15000, 165, "/photos/prestations/balayage.webp"],
      ["Balayage + patine + soin + brushing", "La formule complète, de l'éclaircissement au coiffage.", 17000, 195, "/photos/prestations/balayage-patine.webp"],
      ["Ombré hair", "Dégradé de lumière sur les longueurs.", 15000, 180, "/photos/prestations/ombre-hair.webp", true],
    ],
  ],
  [
    "Lissage & soins capillaires",
    [
      ["Soin hydratant cheveux", "Masque au bac, rinçage et séchage naturel.", 2000, 20, "/photos/prestations/soin-hydratant.webp"],
      ["Soin profond réparateur", "Reconstruit la fibre abîmée, densifie la longueur.", 3000, 30, "/photos/prestations/soin-reparateur.webp"],
      ["Soin kératine", "Assouplit les frisottis et garde le mouvement.", 4000, 45, "/photos/prestations/soin-keratine.webp"],
      ["Hair botox", "Comble la fibre, lisse et fait briller.", 8000, 90, "/photos/prestations/hair-botox.webp", true],
      ["Lissage brésilien cheveux courts", "Discipline la matière pendant plusieurs mois.", 9000, 120, "/photos/prestations/lissage-bresilien.webp"],
      ["Lissage brésilien cheveux mi-longs", "Discipline la matière pendant plusieurs mois.", 12000, 150, "/photos/prestations/lissage-bresilien.webp"],
      ["Lissage brésilien cheveux longs", "Discipline la matière pendant plusieurs mois.", 15000, 180, "/photos/prestations/lissage-bresilien.webp"],
      ["Lissage premium cheveux très longs", "Protocole renforcé sur grande longueur.", 18000, 210, "/photos/prestations/restructuration-capillaire.webp"],
    ],
  ],
  [
    "Onglerie",
    [
      ["Manucure simple", "Mise en forme, cuticules, soin des mains.", 2000, 30, "/photos/prestations/manucure-simple.webp"],
      ["Manucure + vernis classique", "Manucure complète et pose de vernis.", 2500, 40, "/photos/prestations/manucure-vernis-classique.webp"],
      ["Vernis semi-permanent", "Tenue deux à trois semaines, brillance conservée.", 3000, 45, "/photos/prestations/vernis-semi-permanent.webp"],
      ["Semi-permanent French", "Semi-permanent avec French travaillée.", 3500, 60, "/photos/prestations/semi-permanent-french.webp"],
      ["Dépose semi-permanent", "Dépose soignée, sans agresser l'ongle.", 1000, 20, "/photos/prestations/vernis-semi-permanent.webp"],
      ["Pose gel sur ongles naturels", "Renforcement au gel sur l'ongle naturel.", 4500, 75, "/photos/prestations/gel-sur-ongles-naturels.webp"],
      ["Pose gel + extensions", "Rallongement au gel, longueur et forme au choix.", 5500, 90, "/photos/prestations/gel-avec-extensions.webp"],
      ["Remplissage gel", "Reprise de la repousse, toutes les trois à quatre semaines.", 4000, 75, "/photos/prestations/remplissage-gel.webp"],
      ["Nail art simple", "En supplément d'une pose : quelques ongles décorés.", 500, 10, "/photos/prestations/nail-art-simple.webp"],
      ["Nail art élaboré", "En supplément d'une pose : décor travaillé, strass, relief.", 1000, 20, "/photos/prestations/nail-art-elabore.webp", true],
      ["Beauté des pieds", "Pédicure, gommage et soin.", 3000, 45, "/photos/prestations/beaute-des-pieds.webp"],
      ["Beauté des pieds + semi-permanent", "Pédicure complète et pose semi-permanente.", 4500, 60, "/photos/prestations/semi-permanent-pieds.webp"],
    ],
  ],
  [
    "Beauté du regard",
    [
      ["Épilation des sourcils", "Mise en forme à la pince ou à la cire.", 1200, 15, "/photos/prestations/epilation-sourcils.webp"],
      ["Restructuration des sourcils", "Redessine la ligne, sourcils clairsemés ou abîmés.", 2000, 30, "/photos/prestations/restructuration-sourcils.webp"],
      ["Teinture des sourcils", "Intensifie la ligne, tenue plusieurs semaines.", 1500, 20, "/photos/prestations/teinture-sourcils.webp"],
      ["Teinture des cils", "Regard souligné sans maquillage.", 1800, 20, "/photos/prestations/teinture-cils.webp"],
      ["Rehaussement de cils", "Courbe les cils naturels, effet plusieurs semaines.", 4500, 60, "/photos/prestations/rehaussement-de-cils.webp"],
      ["Rehaussement + teinture", "Rehaussement suivi d'une teinture.", 5500, 75, "/photos/prestations/teinture-cils.webp"],
      ["Extensions de cils — cil à cil", "Une extension par cil, résultat naturel.", 6000, 90, "/photos/prestations/extensions-cil-a-cil.webp"],
      ["Extensions de cils — volume mixte", "Mélange de cil à cil et de bouquets.", 7000, 105, "/photos/prestations/extensions-cil-a-cil.webp"],
      ["Extensions de cils — volume russe", "Bouquets légers, densité maximale.", 8000, 120, "/photos/prestations/volume-russe.webp"],
      ["Remplissage extensions de cils", "Reprise toutes les deux à trois semaines.", 4000, 60, "/photos/prestations/remplissage-cils.webp", true],
    ],
  ],
  [
    "Épilation",
    [
      ["Lèvres", "", 800, 10, "/photos/prestations/epilation-levres.webp"],
      ["Menton", "", 1000, 10, "/photos/prestations/epilation-menton.webp"],
      ["Aisselles", "", 1400, 15, "/photos/prestations/epilation-aisselles.webp"],
      ["Demi-jambes", "", 1800, 20, "/photos/prestations/epilation-demi-jambes.webp"],
      ["Jambes complètes", "", 2500, 30, "/photos/prestations/epilation-jambes-completes.webp"],
      ["Maillot classique", "", 1500, 15, "/photos/prestations/maillot-classique.webp"],
      ["Maillot échancré", "", 2000, 20, "/photos/prestations/maillot-echancre.webp"],
      ["Maillot intégral", "", 2500, 30, "/photos/prestations/maillot-integral.webp"],
      ["Bras", "", 1800, 20, "/photos/prestations/epilation-aisselles.webp"],
      ["Dos", "", 2500, 25, "/photos/prestations/epilation-dos.webp"],
    ],
  ],
  [
    "Visage & bien-être",
    [
      ["Soin visage express — 30 min", "Nettoyage, gommage et hydratation.", 3000, 30, "/photos/prestations/soin-visage-hydratant.webp"],
      ["Soin visage classique — 45 min", "Nettoyage, gommage, masque et modelage.", 4500, 45, "/photos/prestations/soin-visage-nettoyant.webp"],
      ["Nettoyage de peau profond", "Extraction des impuretés, peau nette.", 5000, 60, "/photos/prestations/soin-visage-nettoyant.webp"],
      ["Soin visage hydratant", "Repulpe et apaise les peaux déshydratées.", 4500, 45, "/photos/prestations/soin-visage-hydratant.webp"],
      ["Soin visage éclat", "Ravive le teint terne, effet bonne mine.", 5000, 45, "/photos/prestations/soin-visage-eclat.webp"],
      ["Massage du visage", "Modelage drainant et relâchement des traits.", 2500, 30, "/photos/prestations/massage-visage.webp"],
      ["Massage relaxant — 30 min", "Dos et nuque, huiles chaudes.", 3500, 30, "/photos/prestations/massage-relaxant-30min.webp"],
      ["Massage relaxant — 60 min", "Corps entier, pression au choix.", 6000, 60, "/photos/prestations/massage-relaxant-60min.webp"],
    ],
  ],
  [
    "Forfaits",
    [
      ["Forfait Beauty Express", "Brushing, manucure simple et sourcils.", 4500, 90, "/photos/prestations/manucure-vernis-classique.webp"],
      ["Forfait Glow", "Soin visage, sourcils et semi-permanent.", 7500, 105, "/photos/prestations/soin-visage-eclat.webp"],
      ["Forfait Femme", "Coupe, brushing et soin profond.", 6500, 90, "/photos/prestations/coupe-femme.webp"],
      ["Forfait Color", "Coloration, coupe, brushing et soin.", 12000, 180, "/photos/prestations/coloration-complete.webp"],
      ["Forfait Balayage", "Balayage, patine, soin, coupe et brushing.", 18000, 240, "/photos/prestations/balayage-patine.webp"],
      ["Forfait Mariée / Événement", "Coiffure, maquillage et beauté du regard. Essai en amont.", 15000, 180, "/photos/prestations/coiffure-evenementielle.webp", true],
    ],
  ],
];


/**
 * Un visuel par famille de prestations. Ce sont des planches dessinées aux
 * couleurs de la maison, posées ici pour que la carte ne soit jamais nue : le
 * salon les remplace par ses propres photos depuis l'espace salon, et une
 * valeur déjà saisie n'est jamais écrasée.
 */
const VISUELS: [string, string][] = [
  ["Coiffure", "/prestations/coiffure.svg"],
  ["Coloration & techniques", "/prestations/coloration.svg"],
  ["Lissage & soins capillaires", "/prestations/lissage.svg"],
  ["Onglerie", "/prestations/onglerie.svg"],
  ["Beauté du regard", "/prestations/regard.svg"],
  ["Épilation", "/prestations/epilation.svg"],
  ["Visage & bien-être", "/prestations/visage.svg"],
  ["Forfaits", "/prestations/forfaits.svg"],
];

/**
 * La carte d'origine était la mienne : un catalogue de coiffure inventé, puis
 * sept prestations d'institut relevées sur la vitrine, sans tarif. Le salon a
 * arrêté sa vraie carte — d'où ce remplacement.
 *
 * Les données d'amorçage ne s'appliquent qu'à une base vide : la base en ligne,
 * déjà remplie, ne les aurait jamais vues. La bascule est donc explicite, et
 * ne retire que ce qui porte encore le nom exact d'une prestation d'amorçage :
 * ce que le salon a ajouté ou renommé lui appartient et reste en place.
 */
const CATALOGUE_VERSION = "2";

const ANCIENNES_FAMILLES = [
  "Coupe & coiffage",
  "Couleur & balayage",
  "Lissage & permanente",
  "Soins & rituels",
  "Chignon & occasions",
  "Beauté & ongles",
];

const ANCIENNES_PRESTATIONS = [
  "Shampooing, coupe, brushing", "Coupe seule", "Brushing", "Coupe frange",
  "Coupe enfant", "Boucles & ondulations", "Couleur racines",
  "Couleur complète", "Balayage", "Ombré / tie and dye", "Mèches papier",
  "Patine / gloss", "Lissage brésilien", "Lissage à la kératine",
  "Permanente souple", "Défrisage", "Soin profond", "Rituel botox capillaire",
  "Soin cuir chevelu", "Ampoule anti-chute", "Chignon de mariée",
  "Chignon de soirée", "Coiffure d'invitée", "Essai coiffure mariée",
  "Beauté des mains", "Pose de faux ongles", "Maquillage permanent",
  "Extension de cils", "Tatouage", "Soin visage", "Beauté des pieds",
];

// Ouvert sept jours sur sept, de 10 h à 20 h.
const OPENING: [number, number, number][] = [
  [1, 600, 1200],
  [2, 600, 1200],
  [3, 600, 1200],
  [4, 600, 1200],
  [5, 600, 1200],
  [6, 600, 1200],
  [7, 600, 1200],
];

/**
 * Les premiers horaires étaient les miens : fermé dimanche et lundi, nocturne
 * le jeudi. Le salon ouvre en réalité tous les jours de 10 h à 20 h. La base en
 * ligne les porte déjà : on ne les remplace que s'ils sont restés exactement
 * ceux de l'amorçage — une saisie faite depuis l'espace salon prime toujours.
 */
const ANCIENS_HORAIRES: [number, number, number][] = [
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

    /* ------------------------------------------------------------- la carte */
    // Les données d'amorçage ne s'appliquent qu'à une base vide : la carte du
    // salon doit aussi atteindre la base déjà en ligne. Cette bascule est donc
    // rejouable et ne fait qu'ajouter ce qui manque, une fois l'ancienne carte
    // retirée.
    const [version] = await tx.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'catalogue_version'",
    );

    if ((version?.value ?? "1") !== CATALOGUE_VERSION) {
      // Ne disparaît que ce qui porte encore son nom d'amorçage, dans une
      // famille d'amorçage : une prestation ajoutée ou renommée depuis
      // l'espace salon appartient au salon et reste en place. Les rendez-vous
      // déjà pris gardent leur libellé, recopié sur la ligne du rendez-vous.
      await tx.query(
        `DELETE FROM services
          WHERE name = ANY($1)
            AND category_id IN (SELECT id FROM categories WHERE name = ANY($2))`,
        [ANCIENNES_PRESTATIONS, ANCIENNES_FAMILLES],
      );
      await tx.query(
        `DELETE FROM categories
          WHERE name = ANY($1)
            AND NOT EXISTS (
              SELECT 1 FROM services WHERE category_id = categories.id
            )`,
        [ANCIENNES_FAMILLES],
      );

      // Une famille que le salon a garnie survit au ménage. On la range
      // derrière la carte plutôt que de la laisser en concurrence de rang.
      await tx.query("UPDATE categories SET sort_order = sort_order + 100");

      for (const [rang, [famille, prestations]] of CATALOGUE.entries()) {
        let [row] = await tx.query<{ id: number }>(
          "SELECT id FROM categories WHERE name = $1",
          [famille],
        );
        if (row) {
          await tx.query("UPDATE categories SET sort_order = $1 WHERE id = $2", [
            rang,
            row.id,
          ]);
        } else {
          [row] = await tx.query<{ id: number }>(
            "INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id",
            [famille, rang],
          );
        }

        for (const [
          i,
          [nom, description, prix, duree, photo, plancher],
        ] of prestations.entries()) {
          await tx.query(
            `INSERT INTO services
               (category_id, name, description, price_cents, duration_min,
                sort_order, image, price_from)
             SELECT $1, $2, $3, $4, $5, $6, $7, $8
              WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = $2)`,
            [row.id, nom, description, prix, duree, i, photo, plancher === true],
          );
        }
      }

      await tx.query(
        `INSERT INTO settings (key, value) VALUES ('catalogue_version', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [CATALOGUE_VERSION],
      );
    }

    // Le site a d'abord été mis en ligne avec des coordonnées d'exemple. On les
    // remplace par celles du salon, en ne touchant qu'aux valeurs restées
    // telles quelles : une saisie faite depuis l'espace salon prime toujours.
    const CORRECTIONS: [string, string, string][] = [
      ["shop_name", "Rana Coiffure", "Rana Beauté Coiffure"],
      ["tagline", "Salon de coiffure dames", "Salon de coiffure & institut de beauté"],
      ["address", "12 rue des Lilas", "84 avenue Jean Jaurès"],
      ["postal_code", "75020", "93500"],
      ["city", "Paris", "Pantin"],
      ["phone", "01 23 45 67 89", "01 48 40 07 84"],
      ["instagram", "", "https://www.instagram.com/rana_coiffure/"],
      // Arrivés après la mise en ligne : la base porte déjà une valeur vide,
      // que l'amorçage n'aurait jamais remplacée.
      ["facebook", "", "https://www.facebook.com/share/19R7Scy2vj/"],
      ["whatsapp", "", "33699454556"],
      ["google_maps_url", "", "https://share.google/UZgv6weBz2hVYYkpa"],
    ];
    for (const [cle, exemple, reel] of CORRECTIONS) {
      await tx.query(
        "UPDATE settings SET value = $1 WHERE key = $2 AND value = $3",
        [reel, cle, exemple],
      );
    }

    // Les photos sont arrivées après la bascule : la base en ligne portait
    // déjà la carte, sans image. On les pose sur les prestations qui n'en ont
    // pas encore — une photo choisie depuis l'espace salon n'est jamais
    // écrasée.
    for (const [, prestations] of CATALOGUE) {
      for (const [nom, , , , photo] of prestations) {
        await tx.query(
          "UPDATE services SET image = $1 WHERE name = $2 AND image = ''",
          [photo, nom],
        );
      }
    }

    for (const [nom, image] of VISUELS) {
      await tx.query(
        "UPDATE categories SET image = $1 WHERE name = $2 AND image = ''",
        [image, nom],
      );
    }

    const [{ n: hourCount }] = await tx.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM opening_hours",
    );
    const poseHoraires = async () => {
      for (const [weekday, open, close] of OPENING) {
        await tx.query(
          "INSERT INTO opening_hours (weekday, open_min, close_min) VALUES ($1, $2, $3)",
          [weekday, open, close],
        );
      }
    };

    if (Number(hourCount) === 0) {
      await poseHoraires();
    } else {
      // Base déjà remplie : on ne reprend les horaires que s'ils sont restés
      // ceux de l'amorçage, au créneau près.
      const actuels = await tx.query<{
        weekday: number;
        open_min: number;
        close_min: number;
      }>(
        "SELECT weekday, open_min, close_min FROM opening_hours ORDER BY weekday, open_min",
      );
      const memes =
        actuels.length === ANCIENS_HORAIRES.length &&
        actuels.every(
          (h, i) =>
            h.weekday === ANCIENS_HORAIRES[i][0] &&
            h.open_min === ANCIENS_HORAIRES[i][1] &&
            h.close_min === ANCIENS_HORAIRES[i][2],
        );
      if (memes) {
        await tx.query("DELETE FROM opening_hours");
        await poseHoraires();
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
