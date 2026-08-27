import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/queries";
import { checkResetToken } from "@/lib/admin-reset";
import { LogoBar } from "@/components/site/Logo";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

export default async function ReinitialisationPage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;
  const settings = await getSettings();
  const valide = jeton ? await checkResetToken(jeton) : false;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 py-16">
      <div className="w-full max-w-sm">
        <LogoBar shopName={settings.shop_name} tone="clair" className="h-14 w-auto" />
        <p className="eyebrow mt-7 text-gold-soft">Espace salon</p>
        <h1 className="display mt-3 text-3xl uppercase text-cream">
          {valide ? "Nouveau mot de passe" : "Lien expiré"}
        </h1>

        {valide ? (
          <ResetForm token={jeton!} />
        ) : (
          <>
            <p className="mt-4 text-sm leading-relaxed text-cream/60">
              Ce lien a déjà servi ou a dépassé sa durée de validité.
              Demandez-en un nouveau.
            </p>
            <Link
              href="/admin/mot-de-passe-oublie"
              className="mt-7 inline-block bg-gold px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-cream transition-colors hover:bg-ink"
            >
              Demander un lien
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
