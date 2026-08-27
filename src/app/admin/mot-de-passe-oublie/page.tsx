import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/queries";
import { LogoBar } from "@/components/site/Logo";
import { ResetRequestForm } from "./ResetRequestForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: false },
};

export default async function MotDePasseOubliePage() {
  const settings = await getSettings();

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 py-16">
      <div className="w-full max-w-sm">
        <LogoBar shopName={settings.shop_name} tone="clair" className="h-14 w-auto" />
        <p className="eyebrow mt-7 text-gold-soft">Espace salon</p>
        <h1 className="display mt-3 text-3xl uppercase text-cream">
          Mot de passe oublié
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-cream/60">
          Indiquez l&apos;adresse du compte : un lien vous permettra de choisir
          un nouveau mot de passe. Il est valable 30 minutes et ne fonctionne
          qu&apos;une fois.
        </p>

        <ResetRequestForm />

        <Link
          href="/admin/login"
          className="mt-8 inline-block text-xs uppercase tracking-[0.16em] text-cream/60 transition-colors hover:text-cream"
        >
          ← Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
