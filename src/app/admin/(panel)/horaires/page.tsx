import { getClosures, getOpeningHours } from "@/lib/queries";
import { formatDateLong } from "@/lib/format";
import { todayISO } from "@/lib/time";
import { addClosureAction, deleteClosureAction } from "@/app/admin/actions";
import { ConfirmButton, SubmitButton } from "../ui";
import { HoursForm } from "./HoursForm";
import type { DayInput } from "../WeeklyPlanning";

export const dynamic = "force-dynamic";

export default async function HorairesPage() {
  const today = todayISO();
  const [hours, closures] = await Promise.all([
    getOpeningHours(),
    getClosures(today),
  ]);

  const days: DayInput[] = Array.from({ length: 7 }, (_, i) => {
    const ranges = hours
      .filter((h) => h.weekday === i + 1)
      .sort((a, b) => a.open_min - b.open_min);
    return {
      open: ranges.length > 0,
      ranges: [
        ranges[0] ? { from: ranges[0].open_min, to: ranges[0].close_min } : null,
        ranges[1] ? { from: ranges[1].open_min, to: ranges[1].close_min } : null,
      ],
    };
  });

  return (
    <>
      <h1 className="display text-3xl uppercase">Horaires &amp; fermetures</h1>
      <p className="mt-2 max-w-2xl text-ink/60">
        Les créneaux proposés à la réservation sont calculés à partir de ces
        horaires, de la durée de chaque prestation et du nombre de fauteuils
        défini dans les informations du salon. Un coiffeur doté d&apos;un
        planning personnel suit le sien ; les autres suivent ces horaires.
      </p>

      <HoursForm days={days} />

      <section className="mt-14">
        <h2 className="display text-xl uppercase">Fermetures exceptionnelles</h2>
        <p className="mt-2 text-ink/60">
          Congés, jour férié, formation : aucune réservation ne sera possible à
          ces dates.
        </p>

        <form
          action={addClosureAction}
          className="mt-6 flex flex-wrap items-end gap-3 border border-ink/12 bg-white p-4"
        >
          <label className="text-sm">
            <span className="eyebrow block text-clay">Date</span>
            <input
              type="date"
              name="date"
              required
              min={today}
              className="mt-1 border border-ink/20 px-3 py-2"
            />
          </label>
          <label className="grow text-sm sm:max-w-sm">
            <span className="eyebrow block text-clay">Motif (facultatif)</span>
            <input
              name="reason"
              placeholder="Congés annuels"
              className="mt-1 w-full border border-ink/20 px-3 py-2"
            />
          </label>
          <SubmitButton>Ajouter</SubmitButton>
        </form>

        {closures.length > 0 ? (
          <ul className="mt-6 divide-y divide-ink/10 border border-ink/12 bg-white">
            {closures.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-semibold first-letter:uppercase">{formatDateLong(c.date)}</p>
                  {c.reason && <p className="text-sm text-clay">{c.reason}</p>}
                </div>
                <form>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton
                    message={`Retirer la fermeture du ${c.date} ?`}
                    formAction={deleteClosureAction}
                  >
                    Retirer
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 border border-ink/12 bg-white p-6 text-sm text-clay">
            Aucune fermeture programmée.
          </p>
        )}
      </section>
    </>
  );
}
