"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoBar } from "./Logo";

const LINKS = [
  { href: "/#prestations", label: "Prestations" },
  { href: "/#maison", label: "Le salon" },
  { href: "/#equipe", label: "L'équipe" },
  { href: "/#avis", label: "Avis" },
  { href: "/#infos", label: "Horaires & accès" },
];

export function Header({
  shopName,
  phone,
  transparent = false,
  hasTeam = true,
  hasReviews = true,
  hasClientSpace = true,
}: {
  shopName: string;
  phone: string;
  /** Le héros est clair : la barre y flotte sans fond jusqu'au premier scroll. */
  transparent?: boolean;
  hasTeam?: boolean;
  hasReviews?: boolean;
  hasClientSpace?: boolean;
}) {
  const [scrolled, setScrolled] = useState(!transparent);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  const solid = scrolled || open;
  const links = LINKS.filter(
    (l) =>
      (hasTeam || l.href !== "/#equipe") && (hasReviews || l.href !== "/#avis"),
  );

  // Le site est clair de bout en bout : c'est la déclinaison espresso du
  // verrou qui sert ici, l'or étant réservé aux fonds sombres.
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        solid
          ? "border-b border-line bg-porcelain/85 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-6 px-5 sm:h-20 sm:px-8">
        <Link href="/" aria-label={`${shopName}, accueil`}>
          <LogoBar
            shopName={shopName}
            tone="ink"
            priority
            className="h-11 w-auto transition-transform duration-500 hover:-translate-y-0.5 sm:h-12"
          />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative text-sm text-mute transition-colors hover:text-ink"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-terracotta transition-all duration-400 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {hasClientSpace && (
            <Link
              href="/espace"
              className="hidden text-sm text-mute transition-colors hover:text-terracotta xl:block"
            >
              Mon espace
            </Link>
          )}
          <Link
            href="/reservation"
            className="btn-solid px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            <span>Réserver</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            className="text-ink lg:hidden"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-porcelain px-5 pb-5 lg:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-line py-4 text-mute"
            >
              {l.label}
            </a>
          ))}
          {hasClientSpace && (
            <Link
              href="/espace"
              onClick={() => setOpen(false)}
              className="block border-b border-line py-4 text-mute"
            >
              Mon espace client
            </Link>
          )}
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="block py-4 font-medium text-terracotta"
          >
            {phone}
          </a>
        </nav>
      )}
    </header>
  );
}
