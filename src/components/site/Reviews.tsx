import Image from "next/image";
import type { GoogleReviews } from "@/lib/reviews";
import { Reveal } from "./Reveal";

function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span
      className={`inline-flex gap-0.5 ${className}`}
      role="img"
      aria-label={`${value.toFixed(1).replace(".", ",")} sur 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
            <defs>
              <linearGradient id={`star-${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#9a7b3f" />
                <stop offset={`${fill * 100}%`} stopColor="#e8dcd2" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#star-${i}-${Math.round(fill * 100)})`}
              d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.21l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"
            />
          </svg>
        );
      })}
    </span>
  );
}

export function Reviews({ data }: { data: GoogleReviews }) {
  const average = data.rating.toFixed(1).replace(".", ",");

  return (
    <section id="avis" className="scroll-mt-24 bg-porcelain py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
          {/* ------------------------------------------------------ synthèse */}
          <Reveal>
            <p className="eyebrow text-terracotta">Ce qu&apos;on en dit</p>
            <h2 className="display mt-5 text-[clamp(2.2rem,5vw,3.4rem)] font-light">
              Avis Google
            </h2>
            <span className="rule-grow mt-7 block h-px w-24 bg-brass" />

            <div className="mt-9 border border-line bg-white p-8">
              <div className="flex items-baseline gap-3">
                <span className="display text-6xl lining-nums tabular-nums text-terracotta">
                  {average}
                </span>
                <span className="text-mute">/ 5</span>
              </div>
              <Stars value={data.rating} className="mt-4" />
              <p className="mt-4 text-sm text-mute">
                {data.total} avis publiés sur Google
              </p>

              <div className="mt-6 flex flex-col gap-2 text-sm">
                {data.mapsUri && (
                  <a
                    href={data.mapsUri}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-ink underline-offset-4 transition-colors hover:text-terracotta hover:underline"
                  >
                    Lire tous les avis sur Google ↗
                  </a>
                )}
                {data.writeUri && (
                  <a
                    href={data.writeUri}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-mute underline-offset-4 transition-colors hover:text-terracotta hover:underline"
                  >
                    Laisser un avis ↗
                  </a>
                )}
              </div>
            </div>
          </Reveal>

          {/* --------------------------------------------------------- avis */}
          <div>
            <div className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
              {data.reviews.map((review, i) => (
                <Reveal
                  key={review.id}
                  delay={i * 100}
                  className="w-[85vw] shrink-0 snap-start sm:w-auto"
                >
                  <article className="card flex h-full flex-col p-7">
                    <div className="flex items-center gap-3">
                      {review.photoUri ? (
                        <Image
                          src={review.photoUri}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span
                          className="display flex h-10 w-10 items-center justify-center rounded-full text-sm text-cream"
                          style={{
                            backgroundImage:
                              i % 2 === 0
                                ? "linear-gradient(140deg,#c47a62,#a4553f)"
                                : "linear-gradient(140deg,#8b9a86,#5e6e5b)",
                          }}
                        >
                          {review.author.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        {review.authorUri ? (
                          <a
                            href={review.authorUri}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="block truncate text-sm font-semibold transition-colors hover:text-terracotta"
                          >
                            {review.author}
                          </a>
                        ) : (
                          <p className="truncate text-sm font-semibold">
                            {review.author}
                          </p>
                        )}
                        <p className="text-xs text-mute">{review.relativeTime}</p>
                      </div>
                    </div>

                    <Stars value={review.rating} className="mt-4" />

                    <p className="mt-4 line-clamp-6 grow text-sm leading-relaxed text-mute">
                      {review.text}
                    </p>

                    {review.reviewUri && (
                      <a
                        href={review.reviewUri}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-terracotta"
                      >
                        Lire sur Google ↗
                      </a>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-mute">
              Avis publiés sur Google, affichés tels quels et sans sélection du
              salon. Google n&apos;en met que cinq à disposition : le lien
              « Lire tous les avis » ouvre la liste complète.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
