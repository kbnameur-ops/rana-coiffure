"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDuration, formatPrice } from "@/lib/format";

export type TabService = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  bookable: boolean;
};

export type TabCategory = {
  id: number;
  name: string;
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
                  className={`absolute inset-x-0 -bottom-px h-0.5 origin-left bg-terracotta transition-transform duration-500 ${
                    selected ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div key={current.id} className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {current.services.map((service, i) => (
          <article
            key={service.id}
            style={{ animation: `rise 0.8s var(--ease-out-soft) ${i * 70}ms both` }}
            className="card group flex flex-col p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <h4 className="display text-xl leading-snug">{service.name}</h4>
              <p className="display shrink-0 text-3xl lining-nums tabular-nums text-terracotta">
                {formatPrice(service.price_cents)}
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
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-terracotta"
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
          </article>
        ))}
      </div>
    </div>
  );
}
