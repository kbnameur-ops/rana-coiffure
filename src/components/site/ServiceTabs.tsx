"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatDuration, formatTarif } from "@/lib/format";

export type TabService = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  bookable: boolean;
  /** Photo de la prestation. Vide : la carte s'en tient au texte. */
  image: string;
  price_from: boolean;
};

export type TabCategory = {
  id: number;
  name: string;
  /** Visuel de la famille. Vide : la carte s'affiche sans bandeau. */
  image: string;
  services: TabService[];
};

export function ServiceTabs({ categories }: { categories: TabCategory[] }) {
  const [active, setActive] = useState(0);
  const current = categories[active];

  return (
    <div>
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Catégories de prestations"
          className="inline-flex min-w-full gap-1 border-b border-line"
        >
          {categories.map((category, i) => {
            const selected = i === active;
            return (
              <button
                key={category.id}
                role="tab"
                aria-selected={selected}
                type="button"
                onClick={() => setActive(i)}
                className={`relative whitespace-nowrap px-5 py-4 text-sm font-medium uppercase tracking-[0.12em] transition-colors ${
                  selected ? "text-ink" : "text-mute hover:text-ink"
                }`}
              >
                {category.name}
                <span
                  className={`absolute inset-x-0 -bottom-px h-0.5 origin-left bg-gold transition-transform duration-500 ${
                    selected ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Le bandeau change avec l'onglet : `key` le remonte, donc il rejoue. */}
      {current.image && (
        <figure
          key={`visuel-${current.id}`}
          className="relative mt-10 aspect-[16/6] overflow-hidden"
        >
          <Image
            src={current.image}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1100px"
            className="object-cover"
            style={{ animation: "rise 0.9s var(--ease-out-soft) both" }}
          />
          <span className="absolute inset-0 bg-gradient-to-r from-ink/55 via-ink/15 to-transparent" />
          <figcaption className="absolute bottom-0 left-0 p-6 sm:p-9">
            <span className="display block text-[clamp(1.5rem,3.4vw,2.5rem)] uppercase leading-none text-cream">
              {current.name}
            </span>
            <span className="mt-2 block text-xs uppercase tracking-[0.18em] text-cream/70 lining-nums tabular-nums">
              {current.services.length} prestation
              {current.services.length > 1 ? "s" : ""}
            </span>
          </figcaption>
        </figure>
      )}

      <div key={current.id} className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {current.services.map((service, i) => (
          <article
            key={service.id}
            style={{ animation: `rise 0.8s var(--ease-out-soft) ${i * 70}ms both` }}
            className="card group flex flex-col overflow-hidden"
          >
            {service.image && (
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={service.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
            )}

            <div className="flex grow flex-col p-7">
            <div className="flex items-start justify-between gap-4">
              <h4 className="display text-xl leading-snug">{service.name}</h4>
              <p
                className={`display shrink-0 lining-nums tabular-nums text-gold ${
                  service.price_from ? "text-right text-lg leading-tight" : "text-3xl"
                }`}
              >
                {formatTarif(service.price_cents, service.price_from)}
              </p>
            </div>

            {service.description && (
              <p className="mt-3 grow text-sm leading-relaxed text-mute">
                {service.description}
              </p>
            )}

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-xs uppercase tracking-[0.16em] text-mute">
                {formatDuration(service.duration_min)}
              </span>
              {service.bookable ? (
                <Link
                  href={`/reservation?prestation=${service.id}`}
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-gold"
                >
                  Réserver
                  <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              ) : (
                <span className="text-xs uppercase tracking-[0.16em] text-mute">
                  Sur place
                </span>
              )}
            </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
