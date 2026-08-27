import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/queries";
import { logout } from "@/app/admin/actions";
import { LogoBar } from "@/components/site/Logo";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Espace salon",
  robots: { index: false, follow: false },
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-porcelain">
      <header className="border-b border-ink-line bg-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <LogoBar shopName={settings.shop_name} tone="clair" className="h-11 w-auto" />
            <p className="eyebrow border-l border-ink-line pl-4 text-gold-soft">
              Espace salon
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              target="_blank"
              className="text-cream/60 transition-colors hover:text-cream"
            >
              Voir le site ↗
            </Link>
            <span className="hidden text-cream/60 sm:inline">{session.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="border border-ink-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:border-gold hover:text-gold-soft"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}
