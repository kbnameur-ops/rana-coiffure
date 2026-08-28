import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { LogoMark } from "@/components/site/Logo";
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
  "Beauté des ongles",
  "Soin du visage",
];

const SIGNATURES = [
  {
    title: "Le diagnostic d'abord",
    text: "Longueur, densité, porosité, carnation : on regarde vos cheveux et on vous écoute avant de décider quoi que ce soit.",
  },
  {
    title: "La couleur sur mesure",
    text: "Chaque formule est pesée pour votre base. Balayage, patine, reprise de racines : la lumière d'abord, l'effet de mode ensuite.",
  },
  {
    title: "Le temps qu'il faut",
    text: "Les rendez-vous sont espacés. Personne ne vous presse, personne ne vous laisse une heure sous la machine.",
  },
  {
    title: "Des soins choisis",
    text: "Gammes professionnelles sans sulfates, pensées pour les longueurs colorées. Conseil sincère, jamais de vente forcée.",
  },
];

/** Le titre du héros se compose mot à mot. Décalages fixes, rendus au serveur. */
const TITRE = ["L'art", "de", "la", "coiffure", "féminine"];

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
    image: category.image,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price_cents: s.price_cents,
      duration_min: s.duration_min,
      bookable: s.bookable,
      // Sans photo propre, la prestation s'en tient au texte : le visuel de la
      // famille est déjà en bandeau juste au-dessus, le répéter n'apprend rien.
      image: s.image,
      price_from: s.price_from,
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
        <section className="relative overflow-hidden bg-porcelain pb-16 pt-32 sm:pb-24 sm:pt-36">
          {/* Voiles de couleur : la lumière du lieu, sentie plus que vue. */}
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <span
              className="wash -left-[10%] top-[-12%] h-[36rem] w-[36rem] bg-ink/12"
              style={
                { "--wash-x": "50px", "--wash-y": "30px", "--wash-duration": "28s" } as React.CSSProperties
              }
            />
            <span
              className="wash -right-[12%] top-[6%] h-[32rem] w-[32rem] bg-gold/16"
              style={
                { "--wash-x": "-40px", "--wash-y": "40px", "--wash-duration": "34s" } as React.CSSProperties
              }
            />
            <span
              className="wash bottom-[-18%] left-1/3 h-[30rem] w-[30rem] bg-rose/16"
              style={
                { "--wash-x": "30px", "--wash-y": "-40px", "--wash-duration": "30s" } as React.CSSProperties
              }
            />
          </div>

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:gap-20">
            <div>
              <Reveal>
                <p className="eyebrow flex items-center gap-3 text-gold">
                  <span className="h-px w-10 bg-gold/50" aria-hidden />
                  {settings.address} · {settings.postal_code} {settings.city}
                </p>
              </Reveal>

              <h1 className="display mt-7 text-[clamp(2.8rem,7.5vw,5.25rem)] font-light">
                {TITRE.map((mot, i) => (
                  <span
                    key={mot}
                    className="mr-[0.28em] inline-block"
                    style={{
                      animation: `rise 1s var(--ease-out-soft) ${140 + i * 110}ms both`,
                    }}
                  >
                    {mot}
                  </span>
                ))}
                <span
                  className="voice block text-gold"
                  style={{ animation: "rise 1s var(--ease-out-soft) 700ms both" }}
                >
                  sans précipitation
                </span>
              </h1>

              <Reveal delay={820}>
                <span className="rule-grow mt-9 block h-px w-24 bg-gold" />
                <p className="mt-7 max-w-md text-[1.02rem] leading-relaxed text-mute">
                  Coupe travaillée aux ciseaux, couleur pensée pour votre lumière,
                  coiffage qui tient. On vous écoute avant de toucher aux longueurs.
                </p>
              </Reveal>

              <Reveal delay={920}>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Link
                    href="/reservation"
                    className="btn-solid px-9 py-4 text-xs font-semibold uppercase tracking-[0.2em]"
                  >
                    <span>Prendre rendez-vous</span>
                  </Link>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, "")}`}
                    className="btn-ghost px-9 py-4 text-xs font-semibold uppercase tracking-[0.2em]"
                  >
                    <span>{settings.phone}</span>
                  </a>
                </div>
              </Reveal>

              <div
                className="mt-12 max-w-lg"
                style={{ animation: "rise 1s var(--ease-out-soft) 1040ms both" }}
              >
                <span className="block h-px w-full bg-line" aria-hidden />
                <dl className="grid grid-cols-2 gap-x-8 gap-y-5 py-6 sm:grid-cols-3">
                  <div>
                    <dt className="eyebrow text-mute">Aujourd&apos;hui</dt>
                    <dd className="mt-2 flex items-center gap-2 text-sm">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          openNow ? "bg-sage" : "bg-line"
                        }`}
                        aria-hidden
                      />
                      {closedToday ? "Fermé" : todayLine?.text}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow text-mute">Dès</dt>
                    <dd className="display mt-1 text-2xl text-gold">
                      {formatPrice(priceFrom)}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    {reviews ? (
                      <>
                        <dt className="eyebrow text-mute">Avis Google</dt>
                        <dd className="mt-2 flex items-center gap-2 text-sm">
                          <span className="text-gold">★</span>
                          {reviews.rating.toFixed(1).replace(".", ",")} sur{" "}
                          {reviews.total} avis
                        </dd>
                      </>
                    ) : (
                      <>
                        <dt className="eyebrow text-mute">Réservation</dt>
                        <dd className="mt-2 text-sm">En ligne, à toute heure</dd>
                      </>
                    )}
                  </div>
                </dl>
                <span className="block h-px w-full bg-line" aria-hidden />
              </div>
            </div>

            {/* L'emblème couronné, cerclé d'un anneau d'or qui tourne. */}
            <Reveal
              delay={260}
              className="order-first justify-self-center lg:order-none lg:justify-self-end"
            >
              <div className="relative w-[min(58vw,20rem)]">
                <span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 h-[132%] w-[132%] -translate-x-1/2 -translate-y-1/2 animate-[breathe_9s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(217,186,114,0.32),transparent_68%)]"
                />
                <svg
                  aria-hidden
                  viewBox="0 0 400 400"
                  className="pointer-events-none absolute left-1/2 top-1/2 h-[142%] w-[142%] -translate-x-1/2 -translate-y-1/2 animate-[ring-turn_54s_linear_infinite]"
                >
                  <circle
                    cx="200"
                    cy="200"
                    r="192"
                    fill="none"
                    stroke="#8a6a26"
                    strokeOpacity="0.45"
                    strokeWidth="0.8"
                    strokeDasharray="1.5 13"
                  />
                </svg>
                <LogoMark className="relative h-auto w-full" />
              </div>
            </Reveal>
          </div>

          <span
            aria-hidden
            className="absolute bottom-5 left-1/2 hidden h-8 w-5 -translate-x-1/2 justify-center rounded-full border border-ink/15 pt-1.5 lg:flex"
          >
            <span className="h-1.5 w-1 animate-[scroll-cue_1.9s_ease-in-out_infinite] rounded-full bg-gold" />
          </span>
        </section>

        {/* --------------------------------------------------------- bandeau */}
        <div className="overflow-hidden bg-ink py-3.5">
          <ul className="flex w-max animate-[marquee_52s_linear_infinite] items-center gap-10 pr-10">
            {[...MARQUEE, ...MARQUEE].map((word, i) => (
              <li key={i} className="eyebrow flex items-center gap-10 text-cream/70">
                {word}
                <span className="text-gold-soft/70" aria-hidden>
                  ✦
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------------------------------------------------------- maison */}
        <section
          id="maison"
          className="relative scroll-mt-24 overflow-hidden bg-porcelain py-20 sm:py-28"
        >
          <span
            aria-hidden
            className="wash -left-[6%] top-[18%] h-[28rem] w-[28rem] bg-blush/70"
            style={
              { "--wash-x": "36px", "--wash-y": "-24px", "--wash-duration": "32s" } as React.CSSProperties
            }
          />

          <div className="relative mx-auto grid max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-20">
            <Reveal className="order-2 lg:order-1">
              <p className="eyebrow text-gold">La maison</p>
              <h2 className="display mt-5 text-[clamp(2.2rem,5vw,3.4rem)] font-light">
                Le geste juste,
                <br />
                <span className="voice text-gold">pas la mode</span>
              </h2>
              <span className="rule-grow mt-7 block h-px w-24 bg-gold" />
              <p className="mt-7 text-lg leading-relaxed text-mute">{settings.about}</p>

              <dl className="mt-11 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {SIGNATURES.map((item, i) => (
                  <Reveal key={item.title} delay={i * 110}>
                    <dt className="flex items-baseline gap-3">
                      <span className="numeral text-sm text-gold" aria-hidden>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="display text-xl">{item.title}</span>
                    </dt>
                    <dd className="mt-2.5 pl-8 text-sm leading-relaxed text-mute">
                      {item.text}
                    </dd>
                  </Reveal>
                ))}
              </dl>
            </Reveal>

            <Reveal
              variant="arch"
              delay={180}
              className="arch group order-1 overflow-hidden lg:order-2"
            >
              <div className="relative aspect-4/5">
                <Image
                  src="/photos/salon.jpg"
                  alt={`La salle du salon ${settings.shop_name} : coiffeuses, miroirs et fauteuils`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="animate-[slow-zoom_40s_ease-in-out_infinite_alternate] object-cover"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------- prestations */}
        <section
          id="prestations"
          className="scroll-mt-24 border-y border-line bg-shell py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-8">
                <div className="max-w-xl">
                  <p className="eyebrow text-gold">La carte</p>
                  <h2 className="display mt-5 text-[clamp(2.2rem,5vw,3.4rem)] font-light">
                    Prestations &amp; tarifs
                  </h2>
                  <span className="rule-grow mt-7 block h-px w-24 bg-gold" />
                </div>
                <p className="max-w-sm text-mute">
                  Tarifs affichés, durées réelles. {allServices.length} prestations,
                  réservables en ligne au créneau qui vous arrange.
                </p>
              </div>
            </Reveal>

            <Reveal delay={140} className="mt-12">
              <ServiceTabs categories={tabs} />
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------------- équipe */}
        {team.length > 0 && (
          <section
            id="equipe"
            className="relative scroll-mt-24 overflow-hidden bg-porcelain py-20 sm:py-28"
          >
            <span
              aria-hidden
              className="wash -right-[8%] top-[10%] h-[30rem] w-[30rem] bg-ink/10"
              style={
                { "--wash-x": "-34px", "--wash-y": "26px", "--wash-duration": "30s" } as React.CSSProperties
              }
            />

            <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
              <Reveal>
                <p className="eyebrow text-gold">L&apos;équipe</p>
                <h2 className="display mt-5 text-[clamp(2.2rem,5vw,3.4rem)] font-light">
                  Qui vous coiffe
                </h2>
                <span className="rule-grow mt-7 block h-px w-24 bg-gold" />
                <p className="mt-7 max-w-xl text-lg leading-relaxed text-mute">
                  Demandez votre coiffeuse au moment de réserver, ou laissez le
                  salon vous attribuer la première disponible.
                </p>
              </Reveal>

              <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {team.map((member, i) => (
                  <Reveal key={member.id} delay={i * 100}>
                    <article className="card h-full p-7">
                      <span
                        className="display flex h-16 w-16 items-center justify-center rounded-full text-xl text-cream"
                        style={{
                          backgroundImage:
                            i % 2 === 0
                              ? "linear-gradient(140deg,#3d5178,#1f2e4a)"
                              : "linear-gradient(140deg,#c9a961,#8a6a26)",
                        }}
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </span>
                      <h3 className="display mt-6 text-2xl">{member.name}</h3>
                      {member.role_label && (
                        <p className="mt-1.5 text-sm text-mute">{member.role_label}</p>
                      )}
                      <Link
                        href="/reservation"
                        className="group/lien mt-6 inline-block text-xs font-semibold uppercase tracking-[0.18em] text-gold"
                      >
                        Réserver
                        <span className="ml-1.5 inline-block transition-transform duration-300 group-hover/lien:translate-x-1">
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
          className="scroll-mt-24 border-t border-line bg-shell py-20 sm:py-28"
        >
          <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <p className="eyebrow text-gold">Horaires</p>
              <h2 className="display mt-5 text-[clamp(1.9rem,4vw,2.6rem)] font-light">
                Ouverture
              </h2>
              <span className="rule-grow mt-7 block h-px w-24 bg-gold" />

              <ul className="mt-9 border-t border-line">
                {lines.map((l) => {
                  const isToday = l.weekday === weekday;
                  return (
                    <li
                      key={l.weekday}
                      className={`flex items-baseline justify-between gap-4 border-b border-line py-3.5 ${
                        isToday ? "bg-white px-3 font-semibold" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {isToday && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-gold"
                            aria-hidden
                          />
                        )}
                        {l.label}
                      </span>
                      <span
                        className={`lining-nums tabular-nums ${
                          l.ranges.length ? "text-ink" : "text-mute"
                        }`}
                      >
                        {l.text}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {closures.length > 0 && (
                <p className="mt-6 border-l-2 border-gold bg-white px-4 py-3 text-sm text-mute">
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
                <p className="mt-6 text-sm leading-relaxed text-mute">
                  {settings.booking_notice}
                </p>
              )}
            </Reveal>

            <Reveal delay={160}>
              <p className="eyebrow text-gold">Accès</p>
              <h2 className="display mt-5 text-[clamp(1.9rem,4vw,2.6rem)] font-light">
                Venir au salon
              </h2>
              <span className="rule-grow mt-7 block h-px w-24 bg-gold" />

              <address className="mt-9 text-lg not-italic leading-relaxed">
                {settings.address}
                <br />
                {settings.postal_code} {settings.city}
              </address>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-ghost px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  <span>Itinéraire</span>
                </a>
                <a
                  href={`tel:${settings.phone.replace(/\s/g, "")}`}
                  className="btn-ghost px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  <span>Appeler</span>
                </a>
              </div>

              <div className="relative mt-9 aspect-16/10 overflow-hidden rounded-t-[3rem] rounded-b-sm">
                <Image
                  src="/photos/devanture.jpg"
                  alt={`La devanture du salon ${settings.shop_name}, vue depuis la rue`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="animate-[slow-zoom_44s_ease-in-out_infinite_alternate] object-cover"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="relative overflow-hidden bg-ink py-20 sm:py-28">
          <Image
            src="/visuels/motif.svg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/45" />

          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-10 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
            <Reveal>
              <p className="eyebrow text-gold-soft">Rendez-vous</p>
              <h2 className="display mt-5 max-w-xl text-[clamp(2rem,4.6vw,3.1rem)] font-light text-cream">
                Votre fauteuil vous attend
              </h2>
              <p className="mt-5 max-w-md text-cream/65">
                Choisissez la prestation, la coiffeuse et l&apos;heure. Une minute,
                sans inscription.
              </p>
            </Reveal>
            <Reveal delay={160} className="flex items-center gap-8">
              <LogoMark tone="clair" className="hidden h-24 w-auto opacity-80 lg:block" />
              <Link
                href="/reservation"
                className="btn-solid shrink-0 px-10 py-4 text-xs font-semibold uppercase tracking-[0.2em]"
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
