"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { hasSessionSecret, requiresSessionSecret } from "@/lib/config";
import {
  RESET_MINUTES,
  applyReset,
  createResetToken,
  findAdminByEmail,
  resetEmail,
} from "@/lib/admin-reset";
import { sendMail } from "@/lib/mail";
import { headers } from "next/headers";
import { getSettings } from "@/lib/queries";
import {
  addClosure,
  createStaff,
  deleteBooking,
  deleteClosure,
  deleteStaff,
  replaceOpeningHours,
  replaceStaffHours,
  replaceStaffSkills,
  setBookingStatus,
  setSettings,
  updateStaff,
} from "@/lib/queries";
import { WEEKDAYS } from "@/lib/types";
import { deleteClientData, redeemLoyalty, setClientBirthdate } from "@/lib/clients";
import { makeAccessCode, setStaffCode } from "@/lib/staff-portal";

export type ActionState = { error?: string; success?: string };

/* ------------------------------------------------------------------- auth */

export async function login(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const suite = String(formData.get("suite") ?? "/admin");

  if (!email || !password) return { error: "Identifiants requis." };

  // Refuser la connexion plutôt que d'ouvrir une session signée avec la clé
  // de développement, qui figure en clair dans le dépôt.
  if (requiresSessionSecret() && !hasSessionSecret())
    return {
      error:
        "La variable SESSION_SECRET n'est pas définie sur l'hébergement. Ajoutez-la puis redéployez : sans elle, une session d'administration pourrait être forgée.",
    };

  const sql = await getSql();
  const [user] = await sql.query<{
    id: number;
    email: string;
    password_hash: string;
  }>("SELECT * FROM admin_users WHERE email = $1", [email]);

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return { error: "E-mail ou mot de passe incorrect." };

  const token = await signSession({ sub: String(user.id), email: user.email });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(suite.startsWith("/admin") ? suite : "/admin");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/admin/login");
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8)
    return { error: "Le nouveau mot de passe doit faire au moins 8 caractères." };
  if (next !== confirm) return { error: "Les deux mots de passe diffèrent." };

  const sql = await getSql();
  const [user] = await sql.query<{ password_hash: string }>(
    "SELECT * FROM admin_users WHERE id = $1",
    [Number(session.sub)],
  );
  if (!user || !bcrypt.compareSync(current, user.password_hash))
    return { error: "Mot de passe actuel incorrect." };

  await sql.query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [
    bcrypt.hashSync(next, 10),
    Number(session.sub),
  ]);
  return { success: "Mot de passe mis à jour." };
}

/* -------------------------------------------------------------- catégories */

export async function createCategory(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const sql = await getSql();
  await sql.query(
    "INSERT INTO categories (name, sort_order) VALUES ($1, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories))",
    [name],
  );
  revalidatePath("/admin/prestations");
  revalidatePath("/");
}

/**
 * Nom et visuel d'une famille de prestations. Le visuel est une adresse de
 * fichier : les planches livrées avec le site vivent sous `/prestations/`, une
 * photo déposée par le salon peut être une URL complète.
 */
export async function updateCategory(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const image = String(formData.get("image") ?? "").trim().slice(0, 500);
  if (!id || !name) return;
  const sql = await getSql();
  await sql.query("UPDATE categories SET name = $1, image = $2 WHERE id = $3", [
    name,
    image,
    id,
  ]);
  revalidatePath("/admin/prestations");
  revalidatePath("/reservation");
  revalidatePath("/");
}

/** `direction` est lié à l'action : la valeur portée par un bouton de
 *  soumission n'est pas transmise aux actions serveur. */
export async function moveCategory(direction: number, formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  const dir = direction;
  const sql = await getSql();
  const rows = await sql.query<{ id: number }>(
    "SELECT id FROM categories ORDER BY sort_order, id",
  );
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await sql.transaction(async (tx) => {
    for (const [k, row] of rows.entries())
      await tx.query("UPDATE categories SET sort_order = $1 WHERE id = $2", [
        k,
        row.id,
      ]);
  });
  revalidatePath("/admin/prestations");
  revalidatePath("/");
}

export async function deleteCategory(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return;
  const sql = await getSql();
  await sql.transaction(async (tx) => {
    await tx.query("DELETE FROM services WHERE category_id = $1", [id]);
    await tx.query("DELETE FROM categories WHERE id = $1", [id]);
  });
  revalidatePath("/admin/prestations");
  revalidatePath("/");
}

/* -------------------------------------------------------------- prestations */

function priceToCents(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export async function createService(formData: FormData) {
  await requireSession();
  const categoryId = Number(formData.get("category_id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const sql = await getSql();
  await sql.query(
    `INSERT INTO services
       (category_id, name, description, price_cents, duration_min, sort_order)
     VALUES ($1, $2, $3, $4, $5,
       (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM services WHERE category_id IS NOT DISTINCT FROM $1))`,
    [
      categoryId,
      name,
      String(formData.get("description") ?? "").trim(),
      priceToCents(String(formData.get("price") ?? "0")),
      Math.max(5, Number(formData.get("duration")) || 30),
    ],
  );
  revalidatePath("/admin/prestations");
  revalidatePath("/");
  revalidatePath("/reservation");
}

export async function updateService(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return;
  const sql = await getSql();
  await sql.query(
    `UPDATE services
        SET category_id = $1, name = $2, description = $3, price_cents = $4,
            duration_min = $5, active = $6, bookable = $7
      WHERE id = $8`,
    [
      Number(formData.get("category_id")) || null,
      String(formData.get("name") ?? "").trim(),
      String(formData.get("description") ?? "").trim(),
      priceToCents(String(formData.get("price") ?? "0")),
      Math.max(5, Number(formData.get("duration")) || 30),
      Boolean(formData.get("active")),
      Boolean(formData.get("bookable")),
      id,
    ],
  );
  revalidatePath("/admin/prestations");
  revalidatePath("/");
  revalidatePath("/reservation");
}

export async function moveService(direction: number, formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  const dir = direction;
  const sql = await getSql();
  const [service] = await sql.query<{ category_id: number | null }>(
    "SELECT category_id FROM services WHERE id = $1",
    [id],
  );
  if (!service) return;
  const rows = await sql.query<{ id: number }>(
    `SELECT id FROM services
      WHERE category_id IS NOT DISTINCT FROM $1
      ORDER BY sort_order, id`,
    [service.category_id],
  );
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await sql.transaction(async (tx) => {
    for (const [k, row] of rows.entries())
      await tx.query("UPDATE services SET sort_order = $1 WHERE id = $2", [
        k,
        row.id,
      ]);
  });
  revalidatePath("/admin/prestations");
  revalidatePath("/");
}

export async function deleteService(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id) return;
  const sql = await getSql();
  await sql.query("DELETE FROM services WHERE id = $1", [id]);
  revalidatePath("/admin/prestations");
  revalidatePath("/");
  revalidatePath("/reservation");
}

/* ----------------------------------------------------------------- horaires */

export async function saveOpeningHours(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const rows: { weekday: number; open_min: number; close_min: number }[] = [];

  for (let weekday = 1; weekday <= 7; weekday++) {
    if (!formData.get(`open_${weekday}`)) continue;
    for (const suffix of ["a", "b"]) {
      // Champs absents (plage sans coupure) : rien à enregistrer. `Number(null)`
      // vaudrait 0, d'où le test sur la valeur brute.
      const rawFrom = formData.get(`from_${weekday}_${suffix}`);
      const rawTo = formData.get(`to_${weekday}_${suffix}`);
      if (rawFrom === null || rawTo === null) continue;
      const open = Number(rawFrom);
      const close = Number(rawTo);
      if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
      if (close <= open)
        return {
          error: `${WEEKDAYS[weekday - 1]} : l'heure de fin doit suivre le début.`,
        };
      rows.push({ weekday, open_min: open, close_min: close });
    }
  }

  await replaceOpeningHours(rows);
  revalidatePath("/admin/horaires");
  revalidatePath("/");
  revalidatePath("/reservation");
  return { success: "Horaires enregistrés." };
}

export async function addClosureAction(formData: FormData) {
  await requireSession();
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await addClosure(date, String(formData.get("reason") ?? "").trim());
  revalidatePath("/admin/horaires");
  revalidatePath("/");
}

export async function deleteClosureAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) await deleteClosure(id);
  revalidatePath("/admin/horaires");
  revalidatePath("/");
}

/* --------------------------------------------------------------- paramètres */

const SETTING_KEYS = [
  "shop_name",
  "tagline",
  "about",
  "address",
  "postal_code",
  "city",
  "phone",
  "email",
  "instagram",
  "google_maps_url",
  "google_place_id",
  "google_places_api_key",
  "reviews_enabled",
  "loyalty_threshold",
  "loyalty_reward",
  "no_show_grace_hours",
  "capacity",
  "slot_step_min",
  "min_notice_hours",
  "max_advance_days",
  "booking_notice",
];

export async function saveSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const values: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const raw = formData.get(key);
    if (raw !== null) values[key] = String(raw).trim();
  }
  // Case à cocher : absente du formulaire quand elle est décochée.
  values.reviews_enabled = formData.get("reviews_enabled") ? "1" : "0";
  values.loyalty_enabled = formData.get("loyalty_enabled") ? "1" : "0";
  values.client_space_enabled = formData.get("client_space_enabled") ? "1" : "0";
  if (!values.shop_name) return { error: "Le nom du salon est obligatoire." };

  for (const key of [
    "capacity",
    "slot_step_min",
    "min_notice_hours",
    "max_advance_days",
    "loyalty_threshold",
    "no_show_grace_hours",
  ]) {
    if (values[key] !== undefined && !/^\d+$/.test(values[key]))
      return { error: "Les réglages numériques doivent être des entiers." };
  }

  await setSettings(values);
  revalidatePath("/", "layout");
  return { success: "Informations enregistrées." };
}

/* ----------------------------------------------------------- rendez-vous */

export async function updateBookingStatus(status: string, formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (!id || !["confirmed", "cancelled", "done", "no_show"].includes(status))
    return;
  await setBookingStatus(id, status);
  revalidatePath("/admin");
  revalidatePath("/admin/clients");
}

export async function deleteBookingAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) await deleteBooking(id);
  revalidatePath("/admin");
}

/* ------------------------------------------------------------------ équipe */

export async function createStaffAction(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await createStaff(name, String(formData.get("role_label") ?? "").trim());
  revalidatePath("/admin/equipe");
  revalidatePath("/reservation");
}

export async function updateStaffAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await updateStaff(
    id,
    name,
    String(formData.get("role_label") ?? "").trim(),
    Boolean(formData.get("active")),
  );
  revalidatePath("/admin/equipe");
  revalidatePath("/reservation");
}

export async function deleteStaffAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("id"));
  if (id) await deleteStaff(id);
  revalidatePath("/admin/equipe");
  revalidatePath("/reservation");
}

/**
 * Nouveau code d'accès à l'espace coiffeur. Il n'est lisible qu'une fois,
 * juste après sa création : la base n'en garde que l'empreinte.
 */
export async function regenerateStaffCode(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const id = Number(formData.get("staff_id"));
  if (!id) return { error: "Coiffeur introuvable." };
  const code = makeAccessCode();
  await setStaffCode(id, code);
  revalidatePath("/admin/equipe");
  return {
    success: `Nouveau code : ${code} — notez-le et remettez-le au coiffeur, il ne sera plus affiché.`,
  };
}

/** Planning hebdomadaire et compétences, enregistrés ensemble. */
export async function saveStaffPlanning(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  const staffId = Number(formData.get("staff_id"));
  if (!staffId) return { error: "Coiffeur introuvable." };

  const rows: { weekday: number; open_min: number; close_min: number }[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    if (!formData.get(`open_${weekday}`)) continue;
    for (const suffix of ["a", "b"]) {
      // Champs absents (plage sans coupure) : rien à enregistrer. `Number(null)`
      // vaudrait 0, d'où le test sur la valeur brute.
      const rawFrom = formData.get(`from_${weekday}_${suffix}`);
      const rawTo = formData.get(`to_${weekday}_${suffix}`);
      if (rawFrom === null || rawTo === null) continue;
      const open = Number(rawFrom);
      const close = Number(rawTo);
      if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
      if (close <= open)
        return {
          error: `${WEEKDAYS[weekday - 1]} : l'heure de fin doit suivre le début.`,
        };
      rows.push({ weekday, open_min: open, close_min: close });
    }
  }

  const skills = formData
    .getAll("skill")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));

  await replaceStaffHours(staffId, rows);
  await replaceStaffSkills(staffId, skills);

  revalidatePath("/admin/equipe");
  revalidatePath("/reservation");
  return {
    success: rows.length
      ? "Planning et compétences enregistrés."
      : "Aucun jour coché : ce coiffeur suit désormais les horaires du salon.",
  };
}

/* ----------------------------------------------------------------- clients */

export async function redeemLoyaltyAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("client_id"));
  if (!id) return;
  await redeemLoyalty(id, String(formData.get("note") ?? "").trim());
  revalidatePath("/admin/clients");
}

export async function updateClientBirthdate(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("client_id"));
  const birthdate = String(formData.get("birthdate") ?? "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return;
  await setClientBirthdate(id, birthdate);
  revalidatePath("/admin/clients");
}

export async function deleteClientAction(formData: FormData) {
  await requireSession();
  const id = Number(formData.get("client_id"));
  if (!id) return;
  await deleteClientData(id);
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
}

/* ------------------------------------------------- mot de passe oublié */

async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Merci d'indiquer une adresse e-mail valide." };

  // Réponse identique quelle que soit l'adresse : personne ne doit pouvoir
  // deviner celle du salon en tâtonnant.
  const generic = {
    success:
      "Si cette adresse est celle du compte, un lien de réinitialisation vient d'être envoyé. Il est valable 30 minutes.",
  };

  const admin = await findAdminByEmail(email);
  if (!admin) return generic;

  const settings = await getSettings();
  const token = await createResetToken(admin.id);
  const url = `${await siteOrigin()}/admin/reinitialisation?jeton=${encodeURIComponent(token)}`;

  const sent = await sendMail({
    to: admin.email,
    subject: `Réinitialisation — espace salon ${settings.shop_name}`,
    ...resetEmail({
      shopName: settings.shop_name,
      url,
      minutes: RESET_MINUTES,
    }),
  });

  if (!sent.delivered)
    return {
      error:
        "L'envoi d'e-mail n'est pas configuré sur ce site : le lien de réinitialisation a été écrit dans les journaux du serveur (Vercel → Logs). Copiez-le depuis là.",
    };

  return generic;
}

export async function submitPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("jeton") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8)
    return { error: "Le mot de passe doit faire au moins 8 caractères." };
  if (password !== confirm) return { error: "Les deux saisies diffèrent." };

  const outcome = await applyReset(token, password);
  if (outcome === "jeton-invalide")
    return {
      error:
        "Ce lien a déjà servi ou a expiré. Demandez-en un nouveau depuis la page de connexion.",
    };

  redirect("/admin/login?reinitialise=1");
}
