/**
 * Forme canonique d'un numéro français : chiffres seuls, indicatif
 * international ramené au 0 initial. Deux saisies différentes du même numéro
 * doivent donner la même clé, sinon un client se dédouble.
 */
export function normalisePhone(raw: string): string {
  const digits = (raw ?? "").replace(/[^\d+]/g, "");
  if (!digits) return "";
  let out = digits.replace(/^\+/, "");
  if (out.startsWith("0033")) out = out.slice(4);
  else if (out.startsWith("33") && out.length >= 11) out = out.slice(2);
  out = out.replace(/\D/g, "");
  if (out.length === 9) out = `0${out}`;
  return out;
}
