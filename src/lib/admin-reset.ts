import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getSql } from "./db";

export const RESET_MINUTES = 30;

/** Le jeton voyage en clair dans l'e-mail ; la base n'en garde que l'empreinte. */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function findAdminByEmail(
  email: string,
): Promise<{ id: number; email: string } | undefined> {
  const sql = await getSql();
  const [row] = await sql.query<{ id: number; email: string }>(
    "SELECT id, email FROM admin_users WHERE lower(email) = lower($1)",
    [email.trim()],
  );
  return row;
}

export async function createResetToken(adminId: number): Promise<string> {
  const sql = await getSql();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + RESET_MINUTES * 60_000).toISOString();

  await sql.transaction(async (tx) => {
    // Un seul lien valable à la fois : en demander un nouveau annule le
    // précédent.
    await tx.query("DELETE FROM admin_tokens WHERE admin_id = $1", [adminId]);
    await tx.query(
      "INSERT INTO admin_tokens (admin_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [adminId, hashToken(token), expires],
    );
  });

  return token;
}

/** Vérifie un jeton sans le consommer : sert à afficher le formulaire. */
export async function checkResetToken(token: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query(
    "SELECT 1 FROM admin_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2",
    [hashToken(token), new Date().toISOString()],
  );
  return rows.length > 0;
}

export type ResetOutcome = "ok" | "jeton-invalide";

/** Consomme le jeton et pose le nouveau mot de passe, en une transaction. */
export async function applyReset(
  token: string,
  password: string,
): Promise<ResetOutcome> {
  const sql = await getSql();
  return sql.transaction(async (tx): Promise<ResetOutcome> => {
    const rows = await tx.query<{ admin_id: number }>(
      `UPDATE admin_tokens SET used_at = $1
        WHERE token_hash = $2 AND used_at IS NULL AND expires_at > $1
        RETURNING admin_id`,
      [new Date().toISOString(), hashToken(token)],
    );
    const adminId = rows[0]?.admin_id;
    if (!adminId) return "jeton-invalide";

    await tx.query("UPDATE admin_users SET password_hash = $1 WHERE id = $2", [
      bcrypt.hashSync(password, 10),
      adminId,
    ]);
    return "ok";
  });
}

export function resetEmail(input: {
  shopName: string;
  url: string;
  minutes: number;
}) {
  const text = `Réinitialisation du mot de passe de l'espace salon ${input.shopName} :

${input.url}

Ce lien est valable ${input.minutes} minutes et ne fonctionne qu'une fois.
Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien ne change.`;

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#fbf7ef;font-family:Helvetica,Arial,sans-serif;color:#17150f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e3d9c7" cellpadding="0" cellspacing="0">
      <tr><td style="background:#17150f;padding:22px 28px;color:#fbf7ef;font-size:13px;letter-spacing:.24em;text-transform:uppercase">Espace salon</td></tr>
      <tr><td style="padding:32px 28px">
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">Nouveau mot de passe</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a463c">
          Cliquez pour choisir un nouveau mot de passe. Le lien est valable ${input.minutes} minutes et ne fonctionne qu'une seule fois.
        </p>
        <a href="${input.url}" style="display:inline-block;background:#b8862b;color:#17150f;text-decoration:none;padding:14px 26px;font-size:12px;font-weight:bold;letter-spacing:.18em;text-transform:uppercase">Choisir un mot de passe</a>
        <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#8c8271">
          Si le bouton ne fonctionne pas, copiez cette adresse :<br>
          <span style="word-break:break-all;color:#4a463c">${input.url}</span>
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { text, html };
}
