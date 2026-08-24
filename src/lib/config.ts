/**
 * Réglages lisibles partout, y compris dans `proxy.ts` : ce module ne doit
 * dépendre d'aucun pilote de base ni d'aucune API Node.
 */

export function connectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    undefined
  );
}

/**
 * Vrai si le site peut ouvrir une base. Sans chaîne de connexion, seul le
 * développement local fonctionne : les plateformes sans serveur n'ont pas de
 * disque inscriptible où poser la base embarquée.
 */
export function isDatabaseConfigured(): boolean {
  if (connectionString()) return true;
  return !process.env.VERCEL;
}

/**
 * Vrai si la clé de signature des sessions est fournie par l'hébergement.
 * Sans elle, `auth.ts` retombe sur une valeur de développement présente dans
 * le dépôt : n'importe qui la connaissant pourrait forger une session
 * d'administration. Tolérable en local, jamais en ligne.
 */
export function hasSessionSecret(): boolean {
  return Boolean(process.env.SESSION_SECRET);
}

/**
 * Vrai uniquement sous `next dev`. Les commodités de développement — mot de
 * passe d'administration par défaut, clé de session de repli — s'arrêtent ici :
 * un site construit et servi est joignable par d'autres que son auteur.
 */
export function isDevelopment(): boolean {
  return !process.env.VERCEL && process.env.NODE_ENV !== "production";
}

/** Une clé de signature explicite est exigée hors développement. */
export function requiresSessionSecret(): boolean {
  return !isDevelopment();
}

/**
 * Vrai si `ADMIN_PASSWORD` est fournie par l'hébergement. Elle réinitialise
 * alors le mot de passe à chaque démarrage, ce qui écrase un changement fait
 * depuis l'interface — le salon doit le savoir.
 */
export function adminPasswordPinned(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD) && !isDevelopment();
}
