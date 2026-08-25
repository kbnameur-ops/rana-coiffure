# Rana Coiffure — site du salon

Site vitrine + tunnel de réservation en ligne + interface d'administration
(prestations, tarifs, horaires, rendez-vous), en français, pour un salon de
coiffure dames. Habillage noir et or repris du logo du salon.

- **Site public** : présentation, carte des prestations avec tarifs et durées,
  horaires, accès.
- **Tunnel de réservation** (`/reservation`) : prestation → qui vous coiffe →
  créneau → coordonnées → confirmation. Aucune création de compte, référence de
  réservation générée. L'étape « qui vous coiffe » disparaît tant qu'aucune
  personne n'est enregistrée dans l'équipe.
- **Espace client** (`/espace`) : connexion par lien e-mail, prochain
  rendez-vous avec annulation en ligne, historique par statut, carte de
  fidélité, suppression des données.
- **Espace salon** (`/admin`) : rendez-vous du jour, catalogue des prestations et
  des prix, équipe et plannings, fiches clients et fidélité, horaires
  d'ouverture, fermetures exceptionnelles, informations du salon, mot de passe.

## Stack

| Élément | Choix |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styles | Tailwind CSS v4 |
| Base de données | Postgres — hébergé en production, [PGlite](https://pglite.dev) embarqué en local |
| Authentification admin | cookie de session signé (JWT `jose`) + `bcryptjs` |

En local, aucune installation de base de données n'est nécessaire : sans
`DATABASE_URL`, le site démarre sur un Postgres embarqué (PGlite) qui écrit dans
`data/pgdata`. Même moteur, même SQL qu'en production — pas de divergence de
dialecte entre les deux environnements.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000
```

La base est créée et pré-remplie au premier démarrage (catégories, prestations
d'exemple, horaires, compte administrateur).

## Production

```bash
npm run build
npm run start
```

Il suffit de définir `DATABASE_URL` vers une base Postgres. Le schéma et le jeu
de données initial sont créés automatiquement au premier démarrage, sous verrou
consultatif : plusieurs instances peuvent démarrer en même temps sans amorcer
les données deux fois.

### Déploiement sur Vercel

1. Importer le dépôt dans Vercel.
2. Onglet **Storage** → créer une base Postgres (Neon), l'attacher au projet.
   Vercel injecte `DATABASE_URL` dans les variables d'environnement.
3. Ajouter `SESSION_SECRET`, `ADMIN_EMAIL` et `ADMIN_PASSWORD`.
4. Redéployer.

## Variables d'environnement

Copier `.env.example` vers `.env.local` :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `DATABASE_URL` | connexion Postgres ; absente, PGlite prend le relais en local | — |
| `SESSION_SECRET` | signature du cookie de session — **obligatoire hors `next dev`** | valeur de dev |
| `ADMIN_EMAIL` | e-mail du compte admin créé au premier lancement | `admin@salon.fr` |
| `ADMIN_PASSWORD` | mot de passe initial — **obligatoire hors `next dev`** | `rana2026` sous `next dev` |
| `DATA_DIR` | dossier de la base embarquée locale | `./data` |
| `GOOGLE_PLACES_API_KEY` | clé Google Cloud pour lire les avis (facultatif) | — |
| `RESEND_API_KEY` | envoi des e-mails (réinitialisation du mot de passe admin) | — |
| `MAIL_FROM` | expéditeur des e-mails, ex. `Rana Coiffure <bonjour@…>` | — |
| `SITE_URL` | adresse publique, pour construire les liens de connexion | déduit de la requête |
| `CRON_SECRET` | protège `/api/entretien` | — |
| `SALON_TIMEZONE` | fuseau utilisé pour « aujourd'hui » et les créneaux | `Europe/Paris` |

> Le compte administrateur n'est créé qu'au tout premier démarrage. Pour le
> changer ensuite, utilisez l'onglet **Informations → Sécurité** de l'espace salon.
>
> Tant que `ADMIN_PASSWORD` est fournie, elle est **réappliquée à chaque
> démarrage** : une valeur corrigée après un premier déploiement est donc bien
> reprise, mais elle écrase aussi un mot de passe changé depuis l'interface.
> Retirez la variable une fois le mot de passe choisi dans l'espace salon —
> celui-ci le rappelle.
>
> **Hors `next dev`, deux variables sont obligatoires** : `SESSION_SECRET` et
> `ADMIN_PASSWORD`. Sans la première, la signature des sessions retomberait sur
> une valeur de développement présente dans le dépôt — n'importe qui la
> connaissant pourrait forger une session d'administration. Sans la seconde,
> aucun compte n'est créé : un site joignable ne doit pas démarrer sur un
> identifiant par défaut. La page de connexion indique précisément laquelle
> manque. Sous `next dev`, les valeurs de repli s'appliquent et rien n'est à
> configurer.

## Mot de passe d'administration oublié

Depuis la page de connexion, lien **« Mot de passe oublié ? »** : un lien de
réinitialisation valable 30 minutes et utilisable une fois est envoyé à
l'adresse du compte. La réponse affichée est identique que l'adresse existe ou
non, pour qu'on ne puisse pas deviner celle du salon en tâtonnant.

Tant que l'envoi d'e-mail n'est pas configuré (`RESEND_API_KEY`), le lien est
**écrit dans les journaux du serveur** — sur Vercel : projet → *Logs*. C'est
volontaire : sans cela, un site dont l'e-mail n'est pas encore branché n'aurait
aucun moyen de récupérer un accès perdu.

Au démarrage, le serveur trace aussi les adresses enregistrées :

```
[compte admin] adresses enregistrées : patron@exemple.fr
```

Une adresse inattendue à cet endroit explique à elle seule un échec de
connexion.

## Accès à l'administration

`/admin` → identifiants ci-dessus. **Changez le mot de passe à la première
connexion.**

## L'espace client et la fidélité

`/espace`. Le client se connecte avec son **numéro de téléphone et sa date de
naissance** — pas de mot de passe, pas d'e-mail à recevoir. La fiche client est
créée automatiquement à la première réservation, indexée sur le **téléphone
normalisé** : `06 12 34 56 78`, `0612345678` et `+33612345678` mènent à la même
fiche.

La date de naissance est demandée dans le tunnel de réservation. Un client qui
ne l'a jamais renseignée ne peut pas ouvrir son espace : le salon peut la saisir
pour lui depuis l'onglet **Clients**, qui signale les fiches concernées.

> Une date de naissance n'est pas un secret : elle se devine en quelques
> dizaines de milliers d'essais. Les tentatives sont donc bornées — **cinq
> échecs bloquent le numéro pendant quinze minutes**. Le message d'erreur est
> le même que le numéro existe ou non, pour qu'on ne puisse pas découvrir qui
> est client du salon en tâtonnant. Cette authentification convient à un
> historique de rendez-vous ; elle ne conviendrait pas à des données sensibles.

Il y trouve son prochain rendez-vous, son historique daté avec le statut de
chaque passage, sa carte de fidélité et ses coordonnées.

**Annulation en ligne** : possible tant que l'heure du rendez-vous n'est pas
passée, sans autre condition. Ensuite le rendez-vous bascule en « manqué ».

**Statuts** : `confirmé`, `honoré`, `manqué`, `annulé`. Un rendez-vous confirmé
dont l'heure est dépassée depuis plus que le **délai de grâce**
(12 h par défaut, réglable) passe automatiquement en « manqué » — le salon garde
le temps de le pointer, et rien ne reste indéfiniment « confirmé ». Le balayage
a lieu à l'ouverture de l'espace salon et chaque nuit via `/api/entretien`.

**Fidélité** : un passage **honoré** vaut un tampon, dix tampons donnent la
récompense. Seul le salon peut marquer un passage honoré et remettre la
récompense, depuis l'onglet **Clients** — un client ne peut donc pas gonfler
son compteur en réservant sans venir. Seuil, libellé de la récompense et délai
de grâce se règlent dans **Informations → Espace client & fidélité**.

**Données personnelles** : l'espace client affiche un rappel de l'usage des
informations et propose une suppression définitive. Elle efface la fiche et
anonymise les rendez-vous passés, que le salon conserve pour son planning.

## Les avis Google

La page d'accueil affiche la note moyenne et jusqu'à cinq avis lus sur la fiche
Google du salon. Deux réglages sont nécessaires, dans **Informations → Avis
Google** :

- l'**identifiant de la fiche** (Place ID), à récupérer sur le *Place ID Finder*
  de Google Maps Platform ;
- une **clé d'API** Google Cloud avec l'API *Places API (New)* activée. Préférez
  la variable d'environnement `GOOGLE_PLACES_API_KEY` au champ de l'interface :
  la clé ne transite alors jamais par la base.

Ce que l'API impose, et qui ne se contourne pas :

- **cinq avis maximum**, choisis par Google, sans pagination ni tri ;
- pas de filtrage possible côté salon — les avis sont affichés tels quels, note
  moyenne réelle comprise.

La réponse est mise en cache six heures. Tant que la configuration est
incomplète ou que Google répond en erreur, la section disparaît du site et
l'espace salon indique précisément ce qui manque. Une case à cocher permet
aussi de la masquer volontairement.

## L'espace coiffeur

`/coiffeur`. Chaque coiffeur y entre avec **son nom et un code** remis par le
salon — créé dans l'onglet **Coiffeurs**, affiché une seule fois, la base n'en
gardant que l'empreinte. Cinq échecs bloquent l'accès quinze minutes.

Il y trouve trois choses :

- **sa journée**, jour par jour, avec le statut de chaque rendez-vous ;
- de quoi **déclarer une prestation** réalisée hors réservation, pour un client
  venu sans rendez-vous ;
- ses **cumuls** de la semaine et du mois en cours, détaillés par prestation —
  de quoi préparer la paie sans ressaisie.

Une prestation déclarée part **en attente**. Elle n'entre dans aucun total tant
que le salon ne l'a pas validée depuis l'onglet **Planning** : c'est ce qui
empêche un coiffeur de gonfler ses chiffres lui-même. Les totaux ne comptent
que les prestations au statut « honoré ».

## Le planning du salon

Onglet **Planning** de l'espace salon : une **colonne par coiffeur**, le temps
qui descend. Chaque rendez-vous est posé à sa minute exacte et sa hauteur vaut
sa durée, si bien qu'un chevauchement se voit d'un coup d'œil. Le fond clair
d'une colonne marque les heures travaillées du coiffeur. L'onglet
**Rendez-vous** garde la liste filtrable sur une période, tous coiffeurs
confondus.

## Les coiffeurs

Onglet **Coiffeurs** de l'espace salon. Pour chacun :

- une **disponibilité hebdomadaire** : une plage par jour, réglable de **08h00 à
  minuit**, avec coupure déjeuner facultative ;
- des **compétences** : les prestations qu'il assure. Aucune case cochée = il
  les assure toutes.

Deux règles de repli, dans cet ordre :

- un coiffeur **sans planning** suit les horaires d'ouverture du salon ;
- tant qu'**aucun coiffeur** n'est enregistré, l'étape de choix disparaît du
  tunnel : le client ne choisit que son créneau, calculé sur les horaires
  d'ouverture et le nombre de fauteuils.

Un planning personnel prime sur les horaires d'ouverture : un coiffeur peut
donc travailler au-delà de l'ouverture affichée. Les fermetures exceptionnelles
s'appliquent en revanche à tout le monde.

Le client peut réserver **sans préférence** : le salon lui attribue alors le
coiffeur qualifié le moins chargé ce jour-là, et le nom retenu apparaît sur la
confirmation comme dans la liste des rendez-vous.

## Comment sont calculés les créneaux

Pour une prestation de durée *d* et une date donnée :

1. la date ne doit pas être une fermeture exceptionnelle ;
2. les créneaux sont générés selon le **pas** configuré (15 min par défaut) et
   doivent tenir entièrement dans une plage travaillée ;
3. **avec une équipe** : un créneau est proposé si au moins un coiffeur qualifié
   est libre — ou le coiffeur demandé, s'il a été choisi ;
4. **sans équipe** : un créneau est proposé tant que le nombre de rendez-vous
   simultanés reste inférieur au nombre de **fauteuils** configuré ;
5. le **délai minimum** (2 h par défaut) écarte les créneaux trop proches, et
   l'**horizon** (45 jours) limite les réservations à l'avance.

Ces réglages se modifient dans **Informations → Réservation**.

La disponibilité est revérifiée dans une transaction au moment de la
confirmation : deux clients qui visent le même créneau ne peuvent pas le
réserver tous les deux.

## Personnalisation

- Nom, accroche, présentation, adresse, téléphone, réseaux : **Informations**.
- Prestations, prix, durées, ordre d'affichage, visibilité, réservabilité :
  **Prestations & tarifs**.
- Équipe, plannings et compétences : **Coiffeurs**.
- Les visuels d'ambiance sont dans `public/visuels/` : `interieur.svg` (le
  salon, section « La maison », cadré en arche), `devanture.svg` (section
  « Accès ») et `motif.svg` (fond du bandeau de rappel). Ce sont des
  illustrations vectorielles claires, pensées comme un habillage provisoire :
  remplacez-les par de vraies photographies du salon aux mêmes chemins — le code
  n'a pas à bouger, seul le format change (4/5 pour l'intérieur, 16/10 pour la
  devanture).
- Le logo est dans `public/logo/`, en deux teintes. La version dorée
  (`complet.png`, `horizontal.png`, `embleme.png`) est détourée du fond noir
  d'origine et se pose sur les surfaces espresso : médaillon du héros, bandeau
  de rappel, pied de page, espaces salon et coiffeur. La version espresso
  (`complet-encre.png`, `horizontal-encre.png`, `embleme-encre.png`) est
  reconstruite depuis la silhouette et sert partout ailleurs, sur les fonds
  clairs — l'or se délaverait sur l'ivoire. `src/app/icon.png` sert de favicon.
- La palette et les animations sont dans `src/app/globals.css` : porcelaine et
  coquille d'œuf en fond, terre cuite et sauge pour la couleur, laiton pour les
  filets, espresso pour le texte et les rares aplats sombres. Les mouvements
  (voiles de couleur, révélations au scroll, arches qui se lèvent) sont tous
  neutralisés sous `prefers-reduced-motion`.

## Structure

```
src/
  app/
    page.tsx                 page d'accueil
    reservation/             tunnel de réservation
    api/availability|bookings/  disponibilités et création de rendez-vous
    admin/
      login/                 connexion
      (panel)/               rendez-vous, prestations, coiffeurs, horaires, informations
      actions.ts             server actions (toutes protégées par session)
  components/
    site/                    en-tête, pied de page, logo, avis
    booking/BookingFlow.tsx  tunnel en 4 étapes
  app/espace/                espace client : connexion, rendez-vous, fidélité
  lib/
    clients.ts               fiches client, connexion, statuts, fidélité
    client-session.ts        session de l'espace client
    admin-reset.ts           réinitialisation du mot de passe d'administration
    mail.ts                  envoi des e-mails
    reviews.ts               lecture des avis Google et diagnostic
    db.ts                    pilote Postgres (hébergé / embarqué), schéma, amorçage
    queries.ts               accès aux données
    availability.ts          calcul des créneaux + création de rendez-vous
    auth.ts / session.ts     session administrateur
  proxy.ts                   page d'installation si aucune base, accès /admin
```
