export const TIMEZONE = process.env.SALON_TIMEZONE ?? "Europe/Paris";

/** Date du jour au format YYYY-MM-DD dans le fuseau du salon. */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA => YYYY-MM-DD
}

/** Minutes écoulées depuis minuit dans le fuseau du salon. */
export function nowMinutes(now: Date = new Date()): number {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [h, m] = f.split(":").map(Number);
  return h * 60 + m;
}
