/**
 * Affiché tant qu'aucune base n'est rattachée au déploiement : mieux vaut une
 * marche à suivre qu'une page d'erreur.
 */
export function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-5 py-16">
      <div className="w-full max-w-xl">
        <p className="eyebrow text-terracotta">Dernière étape</p>
        <h1 className="display mt-4 text-[clamp(2rem,6vw,3rem)] uppercase text-cream">
          Base de données à rattacher
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-cream/80">
          Le site est déployé. Il lui manque une base Postgres pour conserver
          les rendez-vous, les tarifs et les horaires.
        </p>

        <ol className="mt-10 space-y-6 border-t border-ink-line pt-8">
          {[
            [
              "Créer la base",
              "Dans le tableau de bord Vercel : onglet Storage → Create Database → Neon (offre gratuite) → rattacher au projet. La variable DATABASE_URL est ajoutée automatiquement.",
            ],
            [
              "Ajouter les variables du salon",
              "Settings → Environment Variables : SESSION_SECRET (une longue chaîne aléatoire), ADMIN_EMAIL et ADMIN_PASSWORD.",
            ],
            [
              "Redéployer",
              "Deployments → Redeploy. Le schéma et la carte des prestations sont créés au premier démarrage.",
            ],
          ].map(([title, text], i) => (
            <li key={title} className="flex gap-5">
              <span className="display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta text-cream">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-cream">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
