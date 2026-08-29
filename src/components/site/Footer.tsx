import Link from "next/link";
import { LogoBar } from "./Logo";
import { formatWhatsapp } from "@/lib/format";
import type { Settings } from "@/lib/types";

export function Footer({ settings }: { settings: Settings }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-cream/75">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <LogoBar shopName={settings.shop_name} tone="clair" className="h-auto w-56" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-cream/55">
            Coiffure et institut de beauté, {settings.postal_code} {settings.city}.
            Coupe, couleur, balayage, lissage, chignon, ongles, cils,
            épilation et soins du visage.
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
          {settings.whatsapp && (
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 block transition-colors hover:text-gold-soft"
            >
              WhatsApp{" "}
              <span className="lining-nums tabular-nums text-cream/55">
                {formatWhatsapp(settings.whatsapp)}
              </span>
            </a>
          )}

          {/* Les réseaux du salon, groupés : c'est là qu'on les cherche. */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {settings.instagram && (
              <a
                href={settings.instagram}
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-gold-soft"
              >
                Instagram ↗
              </a>
            )}
            {settings.facebook && (
              <a
                href={settings.facebook}
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-gold-soft"
              >
                Facebook ↗
              </a>
            )}
            {settings.google_maps_url && (
              <a
                href={settings.google_maps_url}
                target="_blank"
                rel="noreferrer noopener"
                className="transition-colors hover:text-gold-soft"
              >
                Google ↗
              </a>
            )}
          </div>
        </div>

        <div className="text-sm">
          <p className="eyebrow text-gold-soft">Rendez-vous</p>
          <Link
            href="/reservation"
            className="mt-4 inline-block border border-cream/25 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cream transition-all duration-400 hover:-translate-y-0.5 hover:border-gold-soft hover:text-gold-soft"
          >
            Réserver en ligne
          </Link>
          <nav className="mt-6 space-y-2 text-cream/55">
            <Link
              href="/#prestations"
              className="block transition-colors hover:text-cream"
            >
              Prestations &amp; tarifs
            </Link>
            <Link href="/#infos" className="block transition-colors hover:text-cream">
              Horaires &amp; accès
            </Link>
            {settings.client_space_enabled !== "0" && (
              <Link href="/espace" className="block transition-colors hover:text-cream">
                Mon espace client
              </Link>
            )}
          </nav>
        </div>
      </div>

      <div className="border-t border-ink-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-cream/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {year} {settings.shop_name}. Tous droits réservés.
          </p>
          <Link href="/admin" className="transition-colors hover:text-cream">
            Espace salon
          </Link>
        </div>
      </div>
    </footer>
  );
}
