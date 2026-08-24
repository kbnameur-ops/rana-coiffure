import Link from "next/link";
import { LogoFull } from "./Logo";
import type { Settings } from "@/lib/types";

export function Footer({ settings }: { settings: Settings }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-bone-dim">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <LogoFull
            shopName={settings.shop_name}
            className="h-auto w-52 drop-shadow-[0_0_40px_rgba(227,196,124,0.16)]"
          />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-clay">
            Salon de coiffure dames, {settings.postal_code} {settings.city}. Coupe,
            couleur, balayage, lissage, chignon et soins.
          </p>
        </div>

        <div className="text-sm">
          <p className="eyebrow text-gold-soft">Le salon</p>
          <address className="mt-4 not-italic leading-relaxed">
            {settings.address}
            <br />
            {settings.postal_code} {settings.city}
          </address>
          <a
            href={`tel:${settings.phone.replace(/\s/g, "")}`}
            className="mt-4 block lining-nums tabular-nums transition-colors hover:text-gold-soft"
          >
            {settings.phone}
          </a>
          {settings.email && (
            <a
              href={`mailto:${settings.email}`}
              className="block transition-colors hover:text-gold-soft"
            >
              {settings.email}
            </a>
          )}
          {settings.instagram && (
            <a
              href={settings.instagram}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-block transition-colors hover:text-gold-soft"
            >
              Instagram ↗
            </a>
          )}
        </div>

        <div className="text-sm">
          <p className="eyebrow text-gold-soft">Rendez-vous</p>
          <Link
            href="/reservation"
            className="mt-4 inline-block border border-gold-soft/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-bone transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-soft hover:text-gold-soft"
          >
            Réserver en ligne
          </Link>
          <nav className="mt-6 space-y-2 text-clay">
            <Link
              href="/#prestations"
              className="block transition-colors hover:text-bone-dim"
            >
              Prestations &amp; tarifs
            </Link>
            <Link href="/#infos" className="block transition-colors hover:text-bone-dim">
              Horaires &amp; accès
            </Link>
            {settings.client_space_enabled !== "0" && (
              <Link href="/espace" className="block transition-colors hover:text-bone-dim">
                Mon espace client
              </Link>
            )}
          </nav>
        </div>
      </div>

      <div className="border-t border-ink-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-clay sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {year} {settings.shop_name}. Tous droits réservés.
          </p>
          <Link href="/admin" className="transition-colors hover:text-bone-dim">
            Espace salon
          </Link>
        </div>
      </div>
    </footer>
  );
}
