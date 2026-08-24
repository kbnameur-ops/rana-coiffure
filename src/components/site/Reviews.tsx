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
                <stop offset={`${fill * 100}%`} stopColor="#e0a92e" />
                <stop offset={`${fill * 100}%`} stopColor="#d8cfbe" />
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
    <section id="avis" className="scroll-mt-24 bg-bone py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
          {/* ------------------------------------------------------ synthèse */}
          <Reveal>
            <p className="eyebrow text-gold">Ce qu&apos;on en dit</p>
            <h2 className="display mt-4 text-[clamp(2.1rem,5.2vw,3.5rem)] uppercase tracking-[0.06em]">
              Avis Google
            </h2>
            <span className="rule-grow mt-6 block h-px w-28 bg-gold" />

            <div className="mt-9 border border-line bg-white p-7">
              <div className="flex items-baseline gap-3">
                <span className="display text-5xl lining-nums tabular-nums">{average}</span>
                <span className="text-clay">/ 5</span>
              </div>
              <Stars value={data.rating} className="mt-3" />
              <p className="mt-4 text-sm text-ink/60">
                {data.total} avis publiés sur Google
              </p>

              <div className="mt-6 flex flex-col gap-2 text-sm">
                {data.mapsUri && (
                  <a
                    href={data.mapsUri}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-ink underline-offset-4 transition-colors hover:text-gold hover:underline"
                  >
                    Lire tous les avis sur Google ↗
                  </a>
                )}
                {data.writeUri && (
                  <a
                    href={data.writeUri}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-clay underline-offset-4 transition-colors hover:text-gold hover:underline"
                  >
                    Laisser un avis ↗
                  </a>
                )}
              </div>
            </div>
          </Reveal>

          {/* --------------------------------------------------------- avis */}
          <div>
            <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
              {data.reviews.map((review, i) => (
                <Reveal
                  key={review.id}
                  delay={i * 90}
                  className="w-[85vw] shrink-0 snap-start sm:w-auto"
                >
                  <article className="flex h-full flex-col border border-line bg-white p-6 transition-all duration-400 hover:-translate-y-1 hover:shadow-xl hover:shadow-ink/8">
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
                        <span className="display flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm text-bone">
                          {review.author.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        {review.authorUri ? (
                          <a
                            href={review.authorUri}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="block truncate text-sm font-semibold hover:text-gold"
                          >
                            {review.author}
                          </a>
                        ) : (
                          <p className="truncate text-sm font-semibold">
                            {review.author}
                          </p>
                        )}
                        <p className="text-xs text-clay">{review.relativeTime}</p>
                      </div>
                    </div>

                    <Stars value={review.rating} className="mt-4" />

                    <p className="mt-4 line-clamp-6 grow text-sm leading-relaxed text-ink/70">
                      {review.text}
                    </p>

                    {review.reviewUri && (
                      <a
                        href={review.reviewUri}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition-colors hover:text-gold"
                      >
                        Lire sur Google ↗
                      </a>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-clay">
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
