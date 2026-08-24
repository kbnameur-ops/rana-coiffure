import "server-only";

/**
 * Envoi d'e-mail. Resend si `RESEND_API_KEY` est présent, sinon on trace le
 * message dans les journaux : en développement le lien reste utilisable, et
 * en production l'absence de configuration se voit immédiatement.
 */
export type MailResult = { delivered: boolean; reason?: string };

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!key || !from) {
    console.info(
      `[courriel non envoyé — RESEND_API_KEY ou MAIL_FROM manquant]\nÀ : ${input.to}\nObjet : ${input.subject}\n${input.text}`,
    );
    return { delivered: false, reason: "configuration manquante" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "Envoi d'e-mail refusé",
        response.status,
        (await response.text()).slice(0, 300),
      );
      return { delivered: false, reason: "refus du fournisseur" };
    }
    return { delivered: true };
  } catch (error) {
    console.error("Envoi d'e-mail impossible", error);
    return { delivered: false, reason: "erreur réseau" };
  }
}

export function magicLinkEmail(input: {
  shopName: string;
  url: string;
  minutes: number;
}) {
  const text = `Votre lien de connexion à l'espace client ${input.shopName} :

${input.url}

Ce lien est valable ${input.minutes} minutes et ne fonctionne qu'une fois.
Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#fbf7ef;font-family:Helvetica,Arial,sans-serif;color:#17150f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e3d9c7" cellpadding="0" cellspacing="0">
      <tr><td style="background:#17150f;padding:22px 28px;color:#fbf7ef;font-size:13px;letter-spacing:.24em;text-transform:uppercase">${escapeHtml(input.shopName)}</td></tr>
      <tr><td style="padding:32px 28px">
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">Votre espace client</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a463c">
          Cliquez sur le bouton pour accéder à vos rendez-vous et à votre carte de fidélité.
          Le lien est valable ${input.minutes} minutes et ne fonctionne qu'une seule fois.
        </p>
        <a href="${input.url}" style="display:inline-block;background:#b8862b;color:#17150f;text-decoration:none;padding:14px 26px;font-size:12px;font-weight:bold;letter-spacing:.18em;text-transform:uppercase">Ouvrir mon espace</a>
        <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#8c8271">
          Si le bouton ne fonctionne pas, copiez cette adresse :<br>
          <span style="word-break:break-all;color:#4a463c">${escapeHtml(input.url)}</span>
        </p>
        <p style="margin:22px 0 0;font-size:13px;color:#8c8271">
          Vous n'êtes pas à l'origine de cette demande ? Ignorez ce message.
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { text, html };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
