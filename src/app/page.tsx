import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { LogoFull, LogoMark } from "@/components/site/Logo";
import { ServiceTabs, type TabCategory } from "@/components/site/ServiceTabs";
import { Reviews } from "@/components/site/Reviews";
import {
  getCatalogue,
  getClosures,
  getOpeningHours,
  getSettings,
  getStaff,
} from "@/lib/queries";
import { formatPrice, isoWeekday } from "@/lib/format";
import { isOpenNow, weekLines } from "@/lib/hours";
import { getGoogleReviews } from "@/lib/reviews";
import { nowMinutes, todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

const MARQUEE = [
  "Coupe & coiffage",
  "Couleur sur mesure",
  "Balayage lumière",
  "Lissage brésilien",
  "Chignon de mariée",
  "Soins profonds",
];

const SIGNATURES = [
  {
    title: "Diagnostic avant tout",
    text: "Longueur, densité, porosité, carnation : on regarde vos cheveux et on vous écoute avant de décider quoi que ce soit.",
  },
  {
    title: "Couleur sur mesure",
    text: "Chaque formule est pesée pour votre base. Balayage, patine, reprise de racines : la lumière d'abord, l'effet de mode ensuite.",
  },
  {
    title: "Le temps qu'il faut",
    text: "Les rendez-vous sont espacés. Personne ne vous presse, personne ne vous laisse une heure sous la machine.",
  },
  {
    title: "Soins d'exception",
    text: "Gammes professionnelles sans sulfates, pensées pour les longueurs colorées. Conseil sincère, jamais de vente forcée.",
  },
];

/**
 * Poussière d'or du héros. Les positions sont fixées en dur : une valeur
 * aléatoire différerait entre le rendu serveur et le client et casserait
 * l'hydratation.
 */
const DUST = [
  { left: "8%", top: "72%", size: 3, delay: "0s", duration: "17s", x: "18px", y: "-70px" },
  { left: "17%", top: "38%", size: 2, delay: "1.4s", duration: "21s", x: "-14px", y: "-90px" },
  { left: "26%", top: "84%", size: 4, delay: "2.6s", duration: "15s", x: "22px", y: "-60px" },
  { left: "38%", top: "26%", size: 2, delay: "0.7s", duration: "24s", x: "12px", y: "-110px" },
  { left: "47%", top: "66%", size: 3, delay: "3.1s", duration: "19s", x: "-20px", y: "-80px" },
  { left: "56%", top: "18%", size: 2, delay: "1.9s", duration: "22s", x: "16px", y: "-95px" },
  { left: "64%", top: "78%", size: 4, delay: "0.4s", duration: "16s", x: "-18px", y: "-65px" },
  { left: "72%", top: "44%", size: 2, delay: "2.2s", duration: "23s", x: "20px", y: "-100px" },
  { left: "81%", top: "30%", size: 3, delay: "1.1s", duration: "18s", x: "-12px", y: "-85px" },
  { left: "88%", top: "70%", size: 2, delay: "3.6s", duration: "20s", x: "14px", y: "-75px" },
  { left: "93%", top: "52%", size: 3, delay: "0.9s", duration: "25s", x: "-16px", y: "-105px" },
  { left: "12%", top: "56%", size: 2, delay: "2.9s", duration: "19s", x: "10px", y: "-88px" },
];

export default async function HomePage() {
  const today = todayISO();
  const [settings, catalogue, hours, closures, team, reviews] = await Promise.all([
    getSettings(),
    getCatalogue(true),
    getOpeningHours(),
    getClosures(today),
    getStaff(true),
    getGoogleReviews(),
  ]);

  const lines = weekLines(hours);
  const weekday = isoWeekday(today);
  const closedToday = closures.some((c) => c.date === today);
  const openNow = isOpenNow(hours, weekday, nowMinutes(), closedToday);
  const todayLine = lines.find((l) => l.weekday === weekday);

  const mapsUrl =
    settings.google_maps_url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${settings.shop_name} ${settings.address} ${settings.postal_code} ${settings.city}`,
    )}`;

  const tabs: TabCategory[] = catalogue.map(({ category, services }) => ({
    id: category.id,
    name: category.name,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price_cents: s.price_cents,
      duration_min: s.duration_min,
      bookable: s.bookable,
    })),
  }));

  const allServices = catalogue.flatMap((g) => g.services);
  const priceFrom = Math.min(...allServices.map((s) => s.price_cents));

  return (
    <>
      <Header
        shopName={settings.shop_name}
        phone={settings.phone}
        transparent
        hasTeam={team.length > 0}
        hasReviews={reviews !== null}
        hasClientSpace={settings.client_space_enabled !== "0"}
      />

      <main>
        {/* ------------------------------------------------------------ héros */}
        <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-ink">
          {/* Halos dorés : la lumière du salon, qui respire lentement. */}
          <div className="absolute inset-0" aria-hidden>
            <div className="absolute left-1/2 top-[42%] h-[110vmax] w-[110vmax] -translate-x-1/2 -translate-y-1/2 animate-[halo_11s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(227,196,124,0.16),rgba(227,196,124,0.04)_38%,transparent_62%)]" />
            <div className="absolute -right-[18%] -top-[12%] h-[70vmax] w-[70vmax] animate-[halo_17s_ease-in-out_infinite_reverse] rounded-full bg-[radial-gradient(circle,rgba(138,106,31,0.34),transparent_62%)]" />
            <div className="absolute -bottom-[22%] -left-[14%] h-[60vmax] w-[60vmax] animate-[halo_14s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(227,196,124,0.1),transparent_65%)]" />
          </div>

          {/* Poussière d'or en suspension. */}
          <div className="absolute inset-0 overflow-hidden" aria-hidden>
            {DUST.map((d, i) => (
              <span
                key={i}
                className="dust"
                style={
                  {
                    left: d.left,
                    top: d.top,
                    width: d.size,
                    height: d.size,
                    "--dust-delay": d.delay,
                    "--dust-duration": d.duration,
                    "--dust-x": d.x,
                    "--dust-y": d.y,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 pt-28 sm:px-8 sm:pb-16">
            <div className="flex flex-col items-center text-center">
              <Reveal>
                <p className="eyebrow flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-gold-soft">
                  <span className="hidden h-px w-10 bg-gold-soft/60 sm:block" aria-hidden />
                  {settings.address} · {settings.postal_code} {settings.city}
                  <span className="hidden h-px w-10 bg-gold-soft/60 sm:block" aria-hidden />
                </p>
              </Reveal>

              <Reveal delay={140} className="relative mt-6 sm:mt-8">
                {/* Anneau doré qui tourne derrière le verrou. */}
                <svg
                  aria-hidden
                  viewBox="0 0 400 400"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[135%] w-[135%] -translate-x-1/2 -translate-y-1/2 animate-[ring-turn_46s_linear_infinite] opacity-40"
                >
                  <circle
                    cx="200"
                    cy="200"
                    r="188"
                    fill="none"
                    stroke="#e3c47c"
                    strokeWidth="0.8"
                    strokeDasharray="2 14"
                  />
                  <circle
                    cx="200"
                    cy="200"
                    r="170"
                    fill="none"
                    stroke="#8a6a1f"
                    strokeWidth="0.6"
                  />
                </svg>

                <LogoFull
                  shopName={settings.shop_name}
                  priority
                  className="relative h-auto w-[min(68vw,21.5rem)] drop-shadow-[0_0_70px_rgba(227,196,124,0.22)]"
                />
                <h1 className="sr-only">
                  {settings.shop_name} — {settings.tagline}
                </h1>
              </Reveal>

              <Reveal delay={300}>
                <p className="voice gold-text mt-7 text-[clamp(1.4rem,3.4vw,2.2rem)]">
                  L&apos;art de la coiffure féminine, sans précipitation
                </p>
              </Reveal>

              <Reveal delay={400}>
                <p className="mx-auto mt-5 max-w-xl text-[0.95rem] leading-relaxed text-bone-dim/75 sm:text-lg">
                  Coupe travaillée aux ciseaux, couleur pensée pour votre lumière,
                  coiffage qui tient. On vous écoute avant de toucher aux longueurs.
                </p>
              </Reveal>

              <Reveal delay={500}>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/reservation"
                    className="gild bg-gold-soft px-8 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition-transform duration-300 hover:-translate-y-0.5 sm:px-10 sm:tracking-[0.24em]"
                  >
                    <span>Prendre rendez-vous</span>
                  </Link>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, "")}`}
                    className="border border-gold-soft/35 px-8 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-bone-dim backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-soft hover:text-gold-soft sm:px-10 sm:tracking-[0.24em]"
                  >
                    {settings.phone}
                  </a>
                </div>
              </Reveal>

              <div
                className="mt-12 w-full max-w-3xl"
                style={{
                  animation: "rise 0.9s var(--ease-out-soft) 620ms both",
                }}
              >
                <span className="hairline block h-px w-full opacity-50" aria-hidden />
                <dl className="grid gap-x-8 gap-y-6 py-6 sm:grid-cols-3">
                  <div>
                    <dt className="eyebrow text-clay">Aujourd&apos;hui</dt>
                    <dd className="mt-2.5 flex items-center justify-center gap-2 text-sm text-bone-dim">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          openNow
                            ? "animate-[glow-pulse_2.4s_ease-in-out_infinite] bg-gold-soft"
                            : "bg-clay"
                        }`}
                      />
                      {closedToday ? "Fermé" : todayLine?.text}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow text-clay">Prestations dès</dt>
                    <dd className="display mt-1.5 text-2xl text-gold-soft">
                      {formatPrice(priceFrom)}
                    </dd>
                  </div>
                  <div>
                    {reviews ? (
                      <>
                        <dt className="eyebrow text-clay">Avis Google</dt>
                        <dd className="mt-2 flex items-center justify-center gap-2 text-sm text-bone-dim">
                          <span className="text-gold-soft">★</span>
                          {reviews.rating.toFixed(1).replace(".", ",")} sur{" "}
                          {reviews.total} avis
                        </dd>
                      </>
                    ) : (
                      <>
                        <dt className="eyebrow text-clay">Réservation</dt>
                        <dd className="mt-2 text-sm text-bone-dim">
                          En ligne, à toute heure
                        </dd>
                      </>
                    )}
                  </div>
                </dl>
                <span className="hairline block h-px w-full opacity-50" aria-hidden />
              </div>
            </div>
          </div>

          <span
            aria-hidden
            className="absolute bottom-6 left-1/2 hidden h-8 w-5 -translate-x-1/2 justify-center rounded-full border border-gold-soft/30 pt-1.5 lg:flex"
          >
            <span className="h-1.5 w-1 animate-[scroll-cue_1.8s_ease-in-out_infinite] rounded-full bg-gold-soft" />
          </span>
        </section>

        {/* --------------------------------------------------------- bandeau */}
        <div className="overflow-hidden border-y border-ink-line bg-ink-soft py-4">
          <ul className="flex w-max animate-[marquee_46s_linear_infinite] items-center gap-10 pr-10">
            {[...MARQUEE, ...MARQUEE].map((word, i) => (
              <li
                key={i}
                className="eyebrow flex items-center gap-10 text-bone-dim/55"
              >
                {word}
                <span className="text-gold-soft">✦</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------------------------------------------------------- maison */}
        <section id="maison" className="scroll-mt-24 bg-bone py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
            <Reveal className="order-2 lg:order-1">
              <p className="eyebrow text-gold">La maison</p>
              <h2 className="display mt-4 text-[clamp(2.1rem,5.2vw,3.5rem)] uppercase tracking-[0.06em]">
                Le geste juste,
                <br />
                pas la mode
              </h2>
              <span className="rule-grow mt-6 block h-px w-28 bg-gold" />
              <p className="mt-7 text-lg leading-relaxed text-ink/70">
                {settings.about}
              </p>

              <dl className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
                {SIGNATURES.map((item, i) => (
                  <Reveal key={item.title} delay={i * 90}>
                    <dt className="flex items-center gap-2.5 font-semibold">
                      <span className="h-1.5 w-1.5 rotate-45 bg-gold" aria-hidden />
                      {item.title}
                    </dt>
                    <dd className="mt-2 pl-4 text-sm leading-relaxed text-ink/60">
                      {item.text}
                    </dd>
                  </Reveal>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={140} className="order-1 lg:order-2">
              <div className="group relative aspect-4/5 overflow-hidden bg-ink">
                <Image
                  src="/visuels/interieur.svg"
                  alt={`Le salon ${settings.shop_name} : miroirs, coiffeuse et fauteuil`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="animate-[slow-pan_34s_ease-in-out_infinite_alternate] object-cover"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-4 border border-gold-soft/25"
                />
                <LogoMark className="pointer-events-none absolute bottom-6 right-6 h-16 w-auto opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------- prestations */}
        <section
          id="prestations"
          className="scroll-mt-24 border-y border-line bg-sand py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="max-w-xl">
                  <p className="eyebrow text-gold">La carte</p>
                  <h2 className="display mt-4 text-[clamp(2.1rem,5.2vw,3.5rem)] uppercase tracking-[0.06em]">
                    Prestations &amp; tarifs
                  </h2>
                  <span className="rule-grow mt-6 block h-px w-28 bg-gold" />
                </div>
                <p className="max-w-sm text-ink/60">
                  Tarifs affichés, durées réelles. {allServices.length} prestations,
                  réservables en ligne au créneau qui vous arrange.
                </p>
              </div>
            </Reveal>

            <Reveal delay={120} className="mt-12">
              <ServiceTabs categories={tabs} />
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------------- équipe */}
        {team.length > 0 && (
          <section
            id="equipe"
            className="relative scroll-mt-24 overflow-hidden bg-ink py-20 sm:py-28"
          >
            <div
              aria-hidden
              className="absolute -right-[10%] top-0 h-[50vmax] w-[50vmax] animate-[halo_16s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(138,106,31,0.22),transparent_65%)]"
            />
            <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
              <Reveal>
                <p className="eyebrow text-gold-soft">L&apos;équipe</p>
                <h2 className="display mt-4 text-[clamp(2.1rem,5.2vw,3.5rem)] uppercase tracking-[0.06em] text-bone">
                  Qui vous coiffe
                </h2>
                <span className="rule-grow hairline mt-6 block h-px w-28" />
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone-dim/70">
                  Demandez votre coiffeuse au moment de réserver, ou laissez le
                  salon vous attribuer la première disponible.
                </p>
              </Reveal>

              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {team.map((member, i) => (
                  <Reveal key={member.id} delay={i * 90}>
                    <article className="luxe-card h-full p-7">
                      <span className="display flex h-14 w-14 items-center justify-center rounded-full border border-gold-soft/40 text-lg text-gold-soft">
                        {member.name.slice(0, 2).toUpperCase()}
                      </span>
                      <h3 className="display mt-5 text-2xl uppercase tracking-[0.06em] text-bone">
                        {member.name}
                      </h3>
                      {member.role_label && (
                        <p className="mt-1.5 text-sm text-clay">{member.role_label}</p>
                      )}
                      <Link
                        href="/reservation"
                        className="group mt-5 inline-block text-xs font-semibold uppercase tracking-[0.18em] text-gold-soft transition-colors hover:text-gold-light"
                      >
                        Réserver
                        <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
                          →
                        </span>
                      </Link>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ avis */}
        {reviews && <Reviews data={reviews} />}

        {/* ----------------------------------------------------------- infos */}
        <section
          id="infos"
          className="scroll-mt-24 border-t border-line bg-sand py-20 sm:py-28"
        >
          <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-2">
            <Reveal>
              <p className="eyebrow text-gold">Horaires</p>
              <h2 className="display mt-4 text-[clamp(1.9rem,4.2vw,2.7rem)] uppercase tracking-[0.06em]">
                Ouverture
              </h2>
              <span className="rule-grow mt-6 block h-px w-28 bg-gold" />

              <ul className="mt-9 border-t border-line">
                {lines.map((l) => {
                  const isToday = l.weekday === weekday;
                  return (
                    <li
                      key={l.weekday}
                      className={`flex items-baseline justify-between gap-4 border-b border-line py-3.5 transition-colors ${
                        isToday ? "bg-white px-3 font-semibold" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {isToday && (
                          <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
                        )}
                        {l.label}
                      </span>
                      <span
                        className={`lining-nums tabular-nums ${l.ranges.length ? "text-ink" : "text-clay"}`}
                      >
                        {l.text}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {closures.length > 0 && (
                <p className="mt-6 border-l-2 border-gold bg-white px-4 py-3 text-sm text-ink/70">
                  Fermeture exceptionnelle :{" "}
                  {closures
                    .slice(0, 3)
                    .map(
                      (c) =>
                        `${c.date.split("-").reverse().slice(0, 2).join("/")}${c.reason ? ` (${c.reason})` : ""}`,
                    )
                    .join(" · ")}
                </p>
              )}

              {settings.booking_notice && (
                <p className="mt-6 text-sm leading-relaxed text-ink/60">
                  {settings.booking_notice}
                </p>
              )}
            </Reveal>

            <Reveal delay={140}>
              <p className="eyebrow text-gold">Accès</p>
              <h2 className="display mt-4 text-[clamp(1.9rem,4.2vw,2.7rem)] uppercase tracking-[0.06em]">
                Venir au salon
              </h2>
              <span className="rule-grow mt-6 block h-px w-28 bg-gold" />

              <address className="mt-9 text-lg not-italic leading-relaxed">
                {settings.address}
                <br />
                {settings.postal_code} {settings.city}
              </address>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="border border-ink/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-bone"
                >
                  Itinéraire
                </a>
                <a
                  href={`tel:${settings.phone.replace(/\s/g, "")}`}
                  className="border border-ink/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-bone"
                >
                  Appeler
                </a>
              </div>

              <div className="relative mt-9 aspect-16/10 overflow-hidden bg-ink">
                <Image
                  src="/visuels/devanture.svg"
                  alt={`La devanture du salon ${settings.shop_name}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="animate-[slow-pan_38s_ease-in-out_infinite_alternate] object-cover"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-4 border border-gold-soft/25"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="relative overflow-hidden bg-ink py-20 sm:py-24">
          <Image
            src="/visuels/motif.svg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/40" />

          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
            <Reveal>
              <p className="eyebrow text-gold-soft">Rendez-vous</p>
              <h2 className="display mt-4 max-w-xl text-[clamp(1.9rem,4.6vw,3.1rem)] uppercase tracking-[0.06em] text-bone">
                Votre fauteuil vous attend
              </h2>
              <p className="mt-4 max-w-md text-bone-dim/70">
                Choisissez la prestation, la coiffeuse et l&apos;heure. Une minute,
                sans inscription.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <Link
                href="/reservation"
                className="gild inline-block shrink-0 bg-gold-soft px-10 py-4 text-xs font-semibold uppercase tracking-[0.24em] text-ink transition-transform duration-300 hover:-translate-y-0.5"
              >
                <span>Réserver maintenant</span>
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer settings={settings} />
    </>
  );
}
