import { listBookings } from "@/lib/queries";
import {
  addDays,
  formatDateLong,
  formatPrice,
  minutesToTime,
} from "@/lib/format";
import { todayISO } from "@/lib/time";
import { deleteBookingAction, updateBookingStatus } from "@/app/admin/actions";
import { sweepNoShows } from "@/lib/clients";
import { ConfirmButton, SubmitButton } from "../ui";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmé",
  done: "Honoré",
  cancelled: "Annulé",
  no_show: "Manqué",
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-ink text-cream",
  done: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-ink/10 text-mute line-through",
  no_show: "bg-red-100 text-red-800",
};

export default async function ListeRendezVousPage({
  searchParams,
}: {
  searchParams: Promise<{ du?: string; au?: string; statut?: string; q?: string }>;
}) {
  const params = await searchParams;
  // Les rendez-vous confirmés dont l'heure est passée depuis le délai de
  // grâce basculent en « manqué » avant l'affichage.
  await sweepNoShows();
  const today = todayISO();
  const from = params.du || today;
  const to = params.au || addDays(from, 20);
  const status = params.statut || "all";
  const search = params.q || "";

  const bookings = await listBookings({ from, to, status, search });
  const byDate = bookings.reduce<Record<string, Booking[]>>((acc, b) => {
    (acc[b.date] ??= []).push(b);
    return acc;
  }, {});

  const todayList = bookings.filter(
    (b) => b.date === today && b.status !== "cancelled",
  );
  const upcoming = bookings.filter((b) => b.status === "confirmed");
  const revenue = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + b.price_cents, 0);

  return (
    <>
      <h1 className="display text-3xl uppercase">Rendez-vous</h1>
      <p className="mt-2 max-w-2xl text-ink/60">
        Toutes les réservations sur une période, tous coiffeurs confondus. Le
        planning du jour, colonne par colonne, est dans l&apos;onglet Planning.
      </p>

      <dl className="mt-8 grid gap-px overflow-hidden border border-ink/12 bg-ink/12 sm:grid-cols-3">
        {[
          ["Aujourd'hui", String(todayList.length)],
          ["À venir (période)", String(upcoming.length)],
          ["Chiffre attendu", formatPrice(revenue)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-5">
            <dt className="eyebrow text-mute">{label}</dt>
            <dd className="display mt-2 text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <form className="mt-8 flex flex-wrap items-end gap-3 border border-ink/12 bg-white p-4">
        <label className="text-sm">
          <span className="eyebrow block text-mute">Du</span>
          <input
            type="date"
            name="du"
            defaultValue={from}
            className="mt-1 border border-ink/20 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="eyebrow block text-mute">Au</span>
          <input
            type="date"
            name="au"
            defaultValue={to}
            className="mt-1 border border-ink/20 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="eyebrow block text-mute">Statut</span>
          <select
            name="statut"
            defaultValue={status}
            className="mt-1 border border-ink/20 px-3 py-2"
          >
            <option value="all">Tous</option>
            <option value="confirmed">Confirmés</option>
            <option value="done">Honorés</option>
            <option value="no_show">Manqués</option>
            <option value="cancelled">Annulés</option>
          </select>
        </label>
        <label className="grow text-sm sm:max-w-xs">
          <span className="eyebrow block text-mute">Recherche</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Nom, téléphone, référence"
            className="mt-1 w-full border border-ink/20 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="bg-ink px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-ink-soft"
        >
          Filtrer
        </button>
      </form>

      {bookings.length === 0 ? (
        <p className="mt-10 border border-ink/12 bg-white p-8 text-ink/60">
          Aucun rendez-vous sur cette période.
        </p>
      ) : (
        <div className="mt-10 space-y-10">
          {Object.entries(byDate).map(([date, list]) => (
            <section key={date}>
              <h2 className="display text-lg uppercase">
                <span className="first-letter:uppercase">{formatDateLong(date)}</span>
                {date === today && (
                  <span className="ml-3 bg-terracotta px-2 py-1 text-[0.65rem] tracking-widest text-cream">
                    Aujourd&apos;hui
                  </span>
                )}
              </h2>

              <ul className="mt-4 divide-y divide-ink/10 border border-ink/12 bg-white">
                {list.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-start gap-4 p-4">
                    <div className="w-20 shrink-0">
                      <p className="display text-lg lining-nums tabular-nums">
                        {minutesToTime(b.start_min)}
                      </p>
                      <p className="text-xs text-mute lining-nums tabular-nums">
                        → {minutesToTime(b.end_min)}
                      </p>
                    </div>

                    <div className="min-w-[12rem] grow">
                      <p className="font-semibold">{b.customer_name}</p>
                      <p className="text-sm text-ink/70">
                        {b.service_name} · {formatPrice(b.price_cents)}
                        {b.staff_name && (
                          <>
                            {" · avec "}
                            <span className="font-medium">{b.staff_name}</span>
                          </>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-mute">
                        <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="underline">
                          {b.phone}
                        </a>
                        {b.email && ` · ${b.email}`}
                        {" · réf. "}
                        {b.ref}
                      </p>
                      {b.notes && (
                        <p className="mt-2 border-l-2 border-terracotta pl-3 text-sm text-ink/70">
                          {b.notes}
                        </p>
                      )}
                    </div>

                    <span
                      className={`shrink-0 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${STATUS_STYLE[b.status]}`}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>

                    <form className="flex shrink-0 flex-wrap gap-2">
                      <input type="hidden" name="id" value={b.id} />
                      {b.status !== "done" && (
                        <SubmitButton
                          variant="ghost"
                          formAction={updateBookingStatus.bind(null, "done")}
                        >
                          Honoré
                        </SubmitButton>
                      )}
                      {b.status !== "no_show" && b.status !== "cancelled" && (
                        <SubmitButton
                          variant="ghost"
                          formAction={updateBookingStatus.bind(null, "no_show")}
                        >
                          Manqué
                        </SubmitButton>
                      )}
                      {b.status !== "cancelled" ? (
                        <ConfirmButton
                          message={`Annuler le rendez-vous de ${b.customer_name} ?`}
                          formAction={updateBookingStatus.bind(null, "cancelled")}
                        >
                          Annuler
                        </ConfirmButton>
                      ) : (
                        <SubmitButton
                          variant="ghost"
                          formAction={updateBookingStatus.bind(null, "confirmed")}
                        >
                          Rétablir
                        </SubmitButton>
                      )}
                      <ConfirmButton
                        message="Supprimer définitivement ce rendez-vous ?"
                        formAction={deleteBookingAction}
                      >
                        Supprimer
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
