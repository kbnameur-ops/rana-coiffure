import Link from "next/link";
import { getOpeningHours, getSettings, getStaff, getStaffHours } from "@/lib/queries";
import { getSql } from "@/lib/db";
import { sweepNoShows } from "@/lib/clients";
import { getPendingWalkIns } from "@/lib/staff-portal";
import { addDays, formatDateLong, formatPrice, minutesToTime } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { DayBoard } from "./DayBoard";
import { ConfirmButton, SubmitButton } from "./ui";
import { updateBookingStatus } from "@/app/admin/actions";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  const { jour } = await searchParams;
  await sweepNoShows();

  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(jour ?? "") ? jour! : today;

  const sql = await getSql();
  const [team, hours, staffHours, bookings, attente, settings] = await Promise.all([
    getStaff(true),
    getOpeningHours(),
    getStaffHours(),
    sql.query<Booking>(
      `SELECT * FROM bookings
        WHERE date = $1 AND status <> 'cancelled'
        ORDER BY start_min`,
      [date],
    ),
    getPendingWalkIns(),
    getSettings(),
  ]);

  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const isoDay = weekday === 0 ? 7 : weekday;

  const attendu = bookings
    .filter((b) => b.status !== "pending")
    .reduce((sum, b) => sum + b.price_cents, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl uppercase">Planning</h1>
          <p className="mt-2 text-ink/60 first-letter:uppercase">
            {formatDateLong(date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin?jour=${addDays(date, -1)}`}
            className="border border-ink/20 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-ink"
          >
            ← Veille
          </Link>
          <Link
            href="/admin"
            className="border border-ink/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-ink"
          >
            Aujourd&apos;hui
          </Link>
          <Link
            href={`/admin?jour=${addDays(date, 1)}`}
            className="border border-ink/20 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-ink"
          >
            Lendemain →
          </Link>
          <form className="flex items-end gap-2">
            <input
              type="date"
              name="jour"
              defaultValue={date}
              className="border border-ink/20 px-3 py-2"
            />
            <button
              type="submit"
              className="bg-ink px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-ink-soft"
            >
              Aller
            </button>
          </form>
        </div>
      </div>

      <dl className="mt-8 grid gap-px overflow-hidden border border-ink/12 bg-ink/12 sm:grid-cols-3">
        {[
          ["Rendez-vous du jour", String(bookings.filter((b) => b.status !== "pending").length)],
          ["Chiffre attendu", formatPrice(attendu)],
          ["À valider", String(attente.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-5">
            <dt className="eyebrow text-mute">{label}</dt>
            <dd className="display mt-2 text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <DayBoard
        date={date}
        team={team}
        bookings={bookings}
        hours={hours.filter((h) => h.weekday === isoDay)}
        staffHours={staffHours.filter((h) => h.weekday === isoDay)}
      />

      <p className="mt-4 text-sm text-mute">
        Le fond clair d&apos;une colonne marque les heures travaillées du
        coiffeur. Cliquer sur un rendez-vous ouvre sa fiche dans la liste.
      </p>

      {/* ------------------------------------------ prestations à valider */}
      <section className="mt-14">
        <h2 className="display text-xl uppercase">Prestations à valider</h2>
        <p className="mt-2 max-w-2xl text-ink/60">
          Saisies par les coiffeurs pour des clients venus sans rendez-vous.
          Elles n&apos;entrent dans aucun total tant qu&apos;elles ne sont pas
          validées.
        </p>

        {attente.length === 0 ? (
          <p className="mt-5 border border-ink/12 bg-white p-6 text-sm text-mute">
            Rien en attente.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-ink/10 border border-ink/12 bg-white">
            {attente.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold first-letter:uppercase">
                    {formatDateLong(b.date).replace(/ \d{4}$/, "")}
                  </p>
                  <p className="text-xs lining-nums tabular-nums text-mute">
                    {minutesToTime(b.start_min)}
                  </p>
                </div>
                <div className="min-w-[12rem] grow">
                  <p className="font-semibold">
                    {b.service_name} · {formatPrice(b.price_cents)}
                  </p>
                  <p className="mt-0.5 text-sm text-ink/60">
                    {b.staff_name} · {b.customer_name}
                    {b.notes && ` · ${b.notes}`}
                  </p>
                </div>
                <form className="flex shrink-0 flex-wrap gap-2">
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton
                    formAction={updateBookingStatus.bind(null, "done")}
                  >
                    Valider
                  </SubmitButton>
                  <ConfirmButton
                    message={`Refuser la prestation déclarée par ${b.staff_name} ?`}
                    formAction={updateBookingStatus.bind(null, "cancelled")}
                  >
                    Refuser
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-sm text-mute">
        Espace coiffeur :{" "}
        <Link href="/coiffeur" className="underline hover:text-ink">
          {settings.shop_name} — /coiffeur
        </Link>
        . Chaque coiffeur y consulte son planning et déclare ses prestations
        avec le code que vous lui remettez dans l&apos;onglet Coiffeurs.
      </p>
    </>
  );
}
