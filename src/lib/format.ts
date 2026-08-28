/** Formatage partagé client / serveur — aucune dépendance à la base. */

export function formatPrice(cents: number): string {
  const euros = cents / 100;
  return Number.isInteger(euros)
    ? `${euros} €`
    : `${euros.toFixed(2).replace(".", ",")} €`;
}

/**
 * Tarif affiché. Un prix « à partir de » est un plancher : le dire évite de
 * promettre un montant que le salon ne peut pas tenir sur une coiffure de
 * mariage ou un nail art travaillé.
 */
export function formatTarif(cents: number, from = false): string {
  return from ? `à partir de ${formatPrice(cents)}` : formatPrice(cents);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function minutesToTime(min: number): string {
  // Une fermeture à minuit vaut 1440 minutes : on l'affiche « 00:00 ».
  const total = min % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Renvoie 1 (lundi) → 7 (dimanche) pour une date "YYYY-MM-DD". */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = dimanche
  return js === 0 ? 7 : js;
}

export function formatDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
