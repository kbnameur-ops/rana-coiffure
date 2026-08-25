import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LoginForm } from "./LoginForm";
import { LoyaltyCard } from "./LoyaltyCard";
import { CancelButton } from "./CancelButton";
import { DeleteAccount } from "./DeleteAccount";
import { logoutClient } from "./actions";
import { getSettings } from "@/lib/queries";
import { getCurrentClient } from "@/lib/client-session";
import { getClientBookings, getLoyalty, sweepNoShows } from "@/lib/clients";
import {
  formatDateLong,
  formatPrice,
  minutesToTime,
} from "@/lib/format";
import { nowMinutes, todayISO } from "@/lib/time";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Espace client",
  robots: { index: false, follow: false },
};

const STATUS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "À venir", className: "bg-ink text-cream" },
  done: { label: "Honorée", className: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Annulée", className: "bg-ink/8 text-mute" },
  no_show: { label: "Manquée", className: "bg-red-100 text-red-800" },
};

export default async function EspacePage({
  searchParams,
}: {
  searchParams: Promise<{ efface?: string }>;
}) {
  const { efface } = await searchParams;
  const settings = await getSettings();
  if (settings.client_space_enabled === "0") notFound();
  const client = await getCurrentClient();

  if (!client) {
    return (
      <Shell settings={settings}>
        <p className="eyebrow text-terracotta">Espace client</p>
        <h1 className="display mt-4 text-[clamp(2rem,6vw,3rem)] uppercase">
          Vos rendez-vous
        </h1>
        <span className="rule-grow mt-6 block h-0.5 w-24 bg-terracotta" />

        {efface && (
          <p className="mt-7 border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Votre espace et vos données ont été supprimés.
          </p>
        )}



        <p className="mt-7 max-w-lg leading-relaxed text-ink/70">
          Retrouvez votre prochain rendez-vous, votre historique et votre carte
          de fidélité. Pas de mot de passe à retenir : votre numéro de
          téléphone et votre date de naissance suffisent.
        </p>

        <div className="mt-2 max-w-lg">
          <LoginForm />
        </div>

        <p className="mt-10 max-w-lg text-sm leading-relaxed text-mute">
          Votre espace se crée tout seul à votre première réservation. La date
          de naissance y est demandée : c&apos;est elle qui vous ouvre l&apos;accès
          ici. Si vous ne l&apos;avez jamais renseignée, indiquez-la au salon ou
          à votre prochain rendez-vous.{" "}
          <Link href="/reservation" className="underline hover:text-ink">
            Prendre rendez-vous
          </Link>
          .
        </p>
      </Shell>
    );
  }

  await sweepNoShows();

  const [bookings, loyalty] = await Promise.all([
    getClientBookings(client.id),
    getLoyalty(client.id, settings),
  ]);

  const today = todayISO();
  const minutes = nowMinutes();
  const isUpcoming = (b: Booking) =>
    b.status === "confirmed" &&
    (b.date > today || (b.date === today && b.start_min > minutes));

  const upcoming = bookings.filter(isUpcoming).reverse();
  const past = bookings.filter((b) => !isUpcoming(b));
  const honoured = bookings.filter((b) => b.status === "done").length;
  const missed = bookings.filter((b) => b.status === "no_show").length;

  return (
    <Shell settings={settings}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-terracotta">Espace client</p>
          <h1 className="display mt-4 text-[clamp(2rem,6vw,3rem)] uppercase">
            Bonjour {client.name.split(" ")[0] || "à vous"}
          </h1>
        </div>
        <form action={logoutClient}>
          <button
            type="submit"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-mute transition-colors hover:text-ink"
          >
            Se déconnecter
          </button>
        </form>
      </div>
      <span className="rule-grow mt-6 block h-0.5 w-24 bg-terracotta" />

      {/* ------------------------------------------------ prochain rendez-vous */}
      <section className="mt-12">
        <h2 className="display text-xl uppercase">Prochain rendez-vous</h2>
        {upcoming.length === 0 ? (
          <div className="mt-5 border border-line bg-white p-7">
            <p className="text-ink/70">Aucun rendez-vous à venir.</p>
            <Link
              href="/reservation"
              className="mt-5 inline-block bg-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-cream transition-colors hover:bg-ink-soft"
            >
              Prendre rendez-vous
            </Link>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {upcoming.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-start justify-between gap-5 border border-line bg-white p-6"
              >
                <div>
                  <p className="display text-2xl uppercase">
                    {minutesToTime(b.start_min)}
                  </p>
                  <p className="mt-1 text-sm first-letter:uppercase">
                    {formatDateLong(b.date)}
                  </p>
                  <p className="mt-3 text-sm text-ink/70">
                    {b.service_name}
                    {b.staff_name && ` · avec ${b.staff_name}`} ·{" "}
                    {formatPrice(b.price_cents)}
                  </p>
                  <p className="mt-1 text-xs text-mute">Référence {b.ref}</p>
                </div>
                <CancelButton
                  id={b.id}
                  label={`${formatDateLong(b.date)} à ${minutesToTime(b.start_min)}`}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm leading-relaxed text-mute">
          L&apos;annulation en ligne est possible jusqu&apos;à l&apos;heure du
          rendez-vous. Passé ce délai, il est compté comme manqué.
        </p>
      </section>

      {/* ---------------------------------------------------------- fidélité */}
      {loyalty.enabled && (
        <div className="mt-14">
          <LoyaltyCard loyalty={loyalty} />
        </div>
      )}

      {/* --------------------------------------------------------- historique */}
      <section className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="display text-xl uppercase">Historique</h2>
          <p className="text-sm text-mute">
            {honoured} passage{honoured > 1 ? "s" : ""} honoré
            {honoured > 1 ? "s" : ""}
            {missed > 0 && ` · ${missed} manqué${missed > 1 ? "s" : ""}`}
          </p>
        </div>

        {past.length === 0 ? (
          <p className="mt-5 border border-line bg-white p-7 text-ink/70">
            Votre historique apparaîtra ici après votre premier passage.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-line border border-line bg-white">
            {past.map((b) => {
              const status = STATUS[b.status] ?? STATUS.confirmed;
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-[12rem]">
                    <p className="text-sm font-semibold first-letter:uppercase">
                      {formatDateLong(b.date)}
                    </p>
                    <p className="mt-1 text-sm text-ink/60">
                      {minutesToTime(b.start_min)} · {b.service_name}
                      {b.staff_name && ` · ${b.staff_name}`}
                    </p>
                  </div>
                  <p className="text-sm lining-nums tabular-nums text-ink/70">
                    {formatPrice(b.price_cents)}
                  </p>
                  <span
                    className={`px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${status.className}`}
                  >
                    {status.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------- coordonnées */}
      <section className="mt-14">
        <h2 className="display text-xl uppercase">Vos coordonnées</h2>
        <dl className="mt-5 grid gap-5 border border-line bg-white p-6 sm:grid-cols-3">
          <div>
            <dt className="eyebrow text-mute">Nom</dt>
            <dd className="mt-2 text-sm">{client.name || "—"}</dd>
          </div>
          <div>
            <dt className="eyebrow text-mute">Téléphone</dt>
            <dd className="mt-2 text-sm lining-nums tabular-nums">{client.phone}</dd>
          </div>
          <div>
            <dt className="eyebrow text-mute">Date de naissance</dt>
            <dd className="mt-2 text-sm">
              {client.birthdate ? formatDateLong(client.birthdate) : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-mute">
          Ces informations proviennent de vos réservations : elles se mettent à
          jour à la prochaine. Elles servent uniquement à gérer vos rendez-vous
          et votre fidélité, et ne sont transmises à personne.
        </p>
        <div className="mt-5">
          <DeleteAccount />
        </div>
      </section>
    </Shell>
  );
}

async function Shell({
  settings,
  children,
}: {
  settings: Awaited<ReturnType<typeof getSettings>>;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header
        shopName={settings.shop_name}
        phone={settings.phone}
        hasTeam={false}
        hasReviews={false}
      />
      <main className="bg-porcelain pt-28 pb-24 sm:pt-32">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">{children}</div>
      </main>
      <Footer settings={settings} />
    </>
  );
}
