import { getSettings } from "@/lib/queries";
import { getReviewsStatus } from "@/lib/reviews";
import { adminPasswordPinned } from "@/lib/config";
import { SettingsForm } from "./SettingsForm";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const [settings, reviews] = await Promise.all([
    getSettings(),
    getReviewsStatus(),
  ]);

  return (
    <>
      <h1 className="display text-3xl uppercase">Informations du salon</h1>
      <p className="mt-2 max-w-2xl text-ink/60">
        Ces informations alimentent la page d&apos;accueil, le pied de page et
        le calcul des créneaux.
      </p>

      <div
        className={`mt-8 border-l-2 px-5 py-4 text-sm leading-relaxed ${
          reviews.configured
            ? "border-emerald-600 bg-emerald-50 text-emerald-900"
            : "border-gold bg-white text-ink/70"
        }`}
      >
        <p className="font-semibold">
          Avis Google — {reviews.configured ? "connecté" : "non configuré"}
        </p>
        <p className="mt-1">
          {reviews.message}
          {reviews.count !== undefined &&
            ` ${reviews.count} avis affichés, note moyenne ${reviews
              .rating!.toFixed(1)
              .replace(".", ",")}.`}
        </p>
        {!reviews.configured && (
          <p className="mt-2 text-ink/60">
            Il faut une clé d&apos;API Google Cloud avec l&apos;API « Places API
            (New) » activée, et l&apos;identifiant de votre fiche. Les deux se
            renseignent ci-dessous.
          </p>
        )}
      </div>

      <SettingsForm settings={settings} />

      <section className="mt-14">
        <h2 className="display text-xl uppercase">Sécurité</h2>
        {adminPasswordPinned() && (
          <p className="mt-4 max-w-2xl border-l-2 border-gold bg-white px-5 py-4 text-sm leading-relaxed text-ink/70">
            La variable <code>ADMIN_PASSWORD</code> est définie sur
            l&apos;hébergement : elle réapplique ce mot de passe à chaque
            déploiement et écrasera donc tout changement fait ici. Retirez-la
            des variables d&apos;environnement une fois votre mot de passe
            choisi.
          </p>
        )}
        <PasswordForm />
      </section>
    </>
  );
}
