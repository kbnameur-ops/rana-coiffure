import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { getSettings, hasAdminAccount } from "@/lib/queries";
import Link from "next/link";
import { LogoBar } from "@/components/site/Logo";
import { hasSessionSecret, requiresSessionSecret } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Espace salon",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; reinitialise?: string }>;
}) {
  const { suite, reinitialise } = await searchParams;
  const [settings, hasAccount] = await Promise.all([
    getSettings(),
    hasAdminAccount(),
  ]);
  const secretManquant = requiresSessionSecret() && !hasSessionSecret();

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 py-16">
      <div className="w-full max-w-sm">
        <LogoBar shopName={settings.shop_name} className="h-14 w-auto" />
        <p className="eyebrow mt-7 text-gold-soft">Espace salon</p>
        <h1 className="display mt-3 text-3xl uppercase text-bone">
          Connexion
        </h1>
        <p className="mt-3 text-sm text-clay">
          Gestion des prestations, des horaires et des rendez-vous.
        </p>
        {reinitialise && (
          <p
            role="status"
            className="mt-8 border-l-2 border-emerald-500 bg-ink-soft px-5 py-4 text-sm leading-relaxed text-bone-dim"
          >
            Mot de passe enregistré. Connectez-vous avec.
          </p>
        )}

        {secretManquant && (
          <div className="mt-8 border-l-2 border-red-500 bg-ink-soft px-5 py-4 text-sm leading-relaxed text-bone-dim">
            <p className="font-semibold text-bone">Clé de session manquante</p>
            <p className="mt-2">
              Ajoutez la variable{" "}
              <code className="text-gold-soft">SESSION_SECRET</code> à
              l&apos;hébergement, puis redéployez. Sans elle, la signature des
              sessions repose sur une valeur de développement présente dans le
              dépôt.
            </p>
          </div>
        )}

        {hasAccount && !secretManquant ? (
          <>
            <LoginForm suite={suite ?? "/admin"} />
            <Link
              href="/admin/mot-de-passe-oublie"
              className="mt-6 inline-block text-xs uppercase tracking-[0.16em] text-clay transition-colors hover:text-gold-soft"
            >
              Mot de passe oublié ?
            </Link>
          </>
        ) : hasAccount ? null : (
          <div className="mt-8 border-l-2 border-gold bg-ink-soft px-5 py-4 text-sm leading-relaxed text-bone-dim">
            <p className="font-semibold text-bone">
              Aucun compte administrateur
            </p>
            <p className="mt-2">
              Par sécurité, aucun compte n&apos;est créé sans mot de passe
              défini. Ajoutez les variables{" "}
              <code className="text-gold-soft">ADMIN_EMAIL</code> et{" "}
              <code className="text-gold-soft">ADMIN_PASSWORD</code> à
              l&apos;hébergement, puis redéployez : le compte sera créé au
              démarrage suivant.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
