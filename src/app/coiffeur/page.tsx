import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogue, getSettings, getStaff } from "@/lib/queries";
import { getCurrentStaff } from "@/lib/staff-session";
import { getActivity, getStaffDay } from "@/lib/staff-portal";
import { LogoBar } from "@/components/site/Logo";
import { LoginForm } from "./LoginForm";
import { WalkInForm } from "./WalkInForm";
import { logoutStaff } from "./actions";
import {
  addDays,
  formatDateLong,
  formatPrice,
  minutesToTime,
} from "@/lib/format";
import { nowMinutes, todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Espace coiffeur",
  robots: { index: false, follow: false },
};

const STATUS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "À venir", className: "bg-ink text-bone" },
  done: { label: "Honorée", className: "bg-emerald-100 text-emerald-800" },
  no_show: { label: "Manquée", className: "bg-red-100 text-red-800" },
  pending: { label: "À valider", className: "bg-gold/20 text-gold" },
};

export default async function CoiffeurPage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  const { jour } = await searchParams;
  const settings = await getSettings();
  const member = await getCurrentStaff();

  if (!member) {
    const team = await getStaff(true);
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-5 py-16">
        <div className="w-full max-w-sm">
          <LogoBar shopName={settings.shop_name} className="h-14 w-auto" />
          <p className="eyebrow mt-7 text-gold-soft">Espace coiffeur</p>
          <h1 className="display mt-3 text-3xl uppercase text-bone">
            Votre journée
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-clay">
            Consultez votre planning et déclarez les prestations réalisées hors
            réservation. Le code vous est remis par le salon.
          </p>

          {team.length === 0 ? (
            <p className="mt-8 border-l-2 border-gold bg-ink-soft px-5 py-4 text-sm text-bone-dim">
              Aucun coiffeur n&apos;est encore enregistré dans le salon.
            </p>
          ) : (
            <LoginForm
              team={team.map((m) => ({
                id: m.id,
                name: m.name,
                role_label: m.role_label,
              }))}
            />
          )}
        </div>
      </main>
    );
  }

  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(jour ?? "") ? jour! : today;
  const [journee, activite, catalogue] = await Promise.all([
    getStaffDay(member.id, date),
    getActivity(member.id),
    getCatalogue(true),
  ]);

  const services = catalogue.flatMap(({ category, services }) =>
    services.map((s) => ({
      id: s.id,
      name: s.name,
      price_cents: s.price_cents,
      category: category.name,
    })),
  );

  // Arrondi aux cinq minutes : personne ne saisit « 8 h 23 ».
  const arrondi = Math.round(nowMinutes() / 5) * 5;
  const heureCourante = `${String(Math.floor(arrondi / 60)).padStart(2, "0")}:${String(
    arrondi % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-bone">
      <header className="bg-ink">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <LogoBar shopName={settings.shop_name} className="h-10 w-auto" />
            <div className="border-l border-ink-line pl-4">
              <p className="eyebrow text-gold-soft">Espace coiffeur</p>
              <p className="display text-lg uppercase text-bone">{member.name}</p>
            </div>
          </div>
          <form action={logoutStaff}>
            <button
              type="submit"
              className="border border-ink-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-bone transition-colors hover:border-gold hover:text-gold-soft"
            >
              Quitter
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        {/* ------------------------------------------------------- cumuls */}
        <dl className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
          <div className="bg-white p-5">
            <dt className="eyebrow text-clay">Cette semaine</dt>
            <dd className="display mt-2 text-2xl">
              {activite.week.count} prestation{activite.week.count > 1 ? "s" : ""}
            </dd>
            <dd className="mt-1 text-sm text-ink/60">
              {formatPrice(activite.week.total)} encaissés
            </dd>
          </div>
          <div className="bg-white p-5">
            <dt className="eyebrow text-clay">Ce mois-ci</dt>
            <dd className="display mt-2 text-2xl">
              {activite.month.count} prestation{activite.month.count > 1 ? "s" : ""}
            </dd>
            <dd className="mt-1 text-sm text-ink/60">
              {formatPrice(activite.month.total)} encaissés
            </dd>
          </div>
          <div className="bg-white p-5">
            <dt className="eyebrow text-clay">En attente de validation</dt>
            <dd className="display mt-2 text-2xl">{activite.pending}</dd>
            <dd className="mt-1 text-sm text-ink/60">
              Non comptées tant que le salon n&apos;a pas validé
            </dd>
          </div>
        </dl>

        {/* ------------------------------------------------------ journée */}
        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="display text-xl uppercase">Ma journée</h2>
            <div className="flex items-center gap-2">
              <Link
                href={`/coiffeur?jour=${addDays(date, -1)}`}
                className="border border-ink/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-ink"
              >
                ←
              </Link>
              <Link
                href="/coiffeur"
                className="border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-ink"
              >
                Aujourd&apos;hui
              </Link>
              <Link
                href={`/coiffeur?jour=${addDays(date, 1)}`}
                className="border border-ink/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-ink"
              >
                →
              </Link>
            </div>
          </div>
          <p className="mt-2 text-ink/60 first-letter:uppercase">
            {formatDateLong(date)}
          </p>

          {journee.length === 0 ? (
            <p className="mt-5 border border-line bg-white p-7 text-ink/60">
              Aucun rendez-vous ce jour-là.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-line border border-line bg-white">
              {journee.map((b) => {
                const statut = STATUS[b.status] ?? STATUS.confirmed;
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="w-20 shrink-0">
                      <p className="display text-lg lining-nums tabular-nums">
                        {minutesToTime(b.start_min)}
                      </p>
                      <p className="text-xs lining-nums tabular-nums text-clay">
                        → {minutesToTime(b.end_min)}
                      </p>
                    </div>
                    <div className="min-w-[10rem] grow">
                      <p className="font-semibold">{b.service_name}</p>
                      <p className="mt-0.5 text-sm text-ink/60">
                        {b.customer_name}
                        {b.source === "walk_in" && " · saisie"}
                      </p>
                    </div>
                    <p className="text-sm lining-nums tabular-nums text-ink/70">
                      {formatPrice(b.price_cents)}
                    </p>
                    <span
                      className={`px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${statut.className}`}
                    >
                      {statut.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ------------------------------------------- prestation hors RDV */}
        <section className="mt-12">
          <h2 className="display text-xl uppercase">
            Déclarer une prestation
          </h2>
          <p className="mt-2 max-w-2xl text-ink/60">
            Pour un client venu sans rendez-vous. La prestation part en attente :
            elle n&apos;entre dans vos totaux qu&apos;une fois validée par le
            salon.
          </p>
          <WalkInForm services={services} today={today} now={heureCourante} />
        </section>

        {/* ----------------------------------------------------- activité */}
        <section className="mt-12">
          <h2 className="display text-xl uppercase">Mon activité</h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            {(
              [
                ["Semaine en cours", activite.week],
                ["Mois en cours", activite.month],
              ] as const
            ).map(([titre, bloc]) => (
              <div key={titre} className="border border-line bg-white">
                <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-4">
                  <p className="eyebrow text-clay">{titre}</p>
                  <p className="text-sm lining-nums tabular-nums text-ink/60">
                    {bloc.from.split("-").reverse().slice(0, 2).join("/")} –{" "}
                    {bloc.to.split("-").reverse().slice(0, 2).join("/")}
                  </p>
                </div>
                {bloc.lines.length === 0 ? (
                  <p className="p-5 text-sm text-clay">
                    Aucune prestation validée sur la période.
                  </p>
                ) : (
                  <>
                    <ul className="divide-y divide-line">
                      {bloc.lines.map((l) => (
                        <li
                          key={l.service_name}
                          className="flex items-baseline justify-between gap-4 px-5 py-3"
                        >
                          <span className="text-sm">{l.service_name}</span>
                          <span className="shrink-0 text-sm lining-nums tabular-nums text-ink/70">
                            × {l.count} · {formatPrice(l.total_cents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-baseline justify-between gap-4 border-t border-line bg-sand px-5 py-4">
                      <span className="eyebrow text-clay">Total</span>
                      <span className="display text-lg lining-nums tabular-nums">
                        {bloc.count} · {formatPrice(bloc.total)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
