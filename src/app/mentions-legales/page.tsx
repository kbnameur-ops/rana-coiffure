import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { getSettings, getStaff } from "@/lib/queries";
import { formatWhatsapp } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Éditeur du site, hébergement, données personnelles et cookies.",
  robots: { index: true, follow: true },
};

/** Une ligne du tableau d'identité, tue quand la valeur manque. */
function Ligne({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
      <dt className="shrink-0 text-sm text-mute">{label}</dt>
      <dd className="text-right font-medium max-sm:text-left">{value}</dd>
    </div>
  );
}

export default async function MentionsPage() {
  const [settings, team] = await Promise.all([getSettings(), getStaff(true)]);

  return (
    <>
      <Header
        shopName={settings.shop_name}
        phone={settings.phone}
        hasTeam={team.length > 0}
        hasReviews={false}
        hasClientSpace={settings.client_space_enabled !== "0"}
      />

      <main className="bg-porcelain pt-28 pb-24 sm:pt-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <p className="eyebrow text-gold">Informations légales</p>
          <h1 className="display mt-4 text-[clamp(2rem,5vw,3rem)] uppercase">
            Mentions légales
          </h1>
          <span className="rule-grow mt-6 block h-px w-24 bg-gold" />

          {/* ------------------------------------------------------ éditeur */}
          <section className="mt-14">
            <h2 className="display text-2xl">Éditeur du site</h2>
            <dl className="mt-6 border-t border-line">
              <Ligne label="Dénomination" value={settings.legal_name} />
              <Ligne label="Forme juridique" value={settings.legal_form} />
              <Ligne label="Capital social" value={settings.legal_capital} />
              <Ligne
                label="Siège social"
                value={`${settings.address}, ${settings.postal_code} ${settings.city}`}
              />
              <Ligne label="SIREN" value={settings.legal_siren} />
              <Ligne label="SIRET (siège)" value={settings.legal_siret} />
              <Ligne
                label="Immatriculation"
                value={settings.legal_rcs}
              />
              <Ligne label="TVA intracommunautaire" value={settings.legal_vat} />
              <Ligne label="Gérante" value={settings.legal_manager} />
              <Ligne label="Téléphone" value={settings.phone} />
              {settings.email && (
                <Ligne label="E-mail" value={settings.email} />
              )}
              {settings.whatsapp && (
                <Ligne
                  label="WhatsApp"
                  value={formatWhatsapp(settings.whatsapp)}
                />
              )}
            </dl>
            {settings.legal_manager && (
              <p className="mt-6 text-sm leading-relaxed text-mute">
                Directrice de la publication : {settings.legal_manager}.
              </p>
            )}
          </section>

          {/* --------------------------------------------------- hébergement */}
          <section className="mt-14">
            <h2 className="display text-2xl">Hébergement</h2>
            <p className="mt-5 leading-relaxed text-ink/75">
              Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133,
              Covina, CA 91723, États-Unis —{" "}
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-gold"
              >
                vercel.com
              </a>
              . Les rendez-vous et les fiches clientes sont enregistrés dans une
              base de données gérée par le même hébergeur.
            </p>
          </section>

          {/* ---------------------------------------------- données person. */}
          <section className="mt-14">
            <h2 className="display text-2xl">Données personnelles</h2>

            <p className="mt-5 leading-relaxed text-ink/75">
              Réserver en ligne suppose de laisser quelques informations. Voici
              lesquelles, pourquoi, et comment les reprendre.
            </p>

            <h3 className="mt-8 font-semibold">Ce qui est enregistré</h3>
            <ul className="mt-3 space-y-2 text-ink/75">
              <li className="flex gap-3">
                <span className="text-gold" aria-hidden>
                  —
                </span>
                Votre nom, votre numéro de téléphone et votre e-mail : ils
                permettent au salon de vous reconnaître et de vous joindre en
                cas d&apos;imprévu.
              </li>
              <li className="flex gap-3">
                <span className="text-gold" aria-hidden>
                  —
                </span>
                Votre date de naissance : associée à votre numéro, c&apos;est
                elle qui ouvre votre espace client.
              </li>
              <li className="flex gap-3">
                <span className="text-gold" aria-hidden>
                  —
                </span>
                Les précisions que vous laissez au moment de réserver — le
                seul champ facultatif du formulaire.
              </li>
              <li className="flex gap-3">
                <span className="text-gold" aria-hidden>
                  —
                </span>
                Vos rendez-vous : prestations, dates, montants, et leur suite —
                honorés, annulés ou manqués.
              </li>
            </ul>

            <h3 className="mt-8 font-semibold">À quoi elles servent</h3>
            <p className="mt-3 leading-relaxed text-ink/75">
              À tenir le planning du salon, à vous permettre de retrouver et
              d&apos;annuler vos rendez-vous depuis votre espace client, et à
              compter vos passages si le salon propose une carte de fidélité.
              Rien n&apos;est vendu ni transmis à un tiers, et aucune publicité
              n&apos;est bâtie dessus.
            </p>

            <h3 className="mt-8 font-semibold">Combien de temps</h3>
            <p className="mt-3 leading-relaxed text-ink/75">
              Votre fiche et l&apos;historique de vos rendez-vous sont conservés
              tant que vous êtes cliente du salon. Aucune suppression
              automatique n&apos;est programmée : c&apos;est vous, ou le salon à
              votre demande, qui décidez de les effacer.
            </p>

            <h3 className="mt-8 font-semibold">Vos droits</h3>
            <p className="mt-3 leading-relaxed text-ink/75">
              Vous pouvez à tout moment consulter, corriger ou faire supprimer
              vos données.{" "}
              {settings.client_space_enabled !== "0" && (
                <>
                  La suppression se fait en autonomie depuis{" "}
                  <Link href="/espace" className="underline hover:text-gold">
                    votre espace client
                  </Link>
                  , et elle efface la fiche et son historique.{" "}
                </>
              )}
              Sinon, demandez-le au salon au{" "}
              <a
                href={`tel:${settings.phone.replace(/\s/g, "")}`}
                className="underline hover:text-gold"
              >
                {settings.phone}
              </a>
              {settings.email && (
                <>
                  {" "}
                  ou à{" "}
                  <a
                    href={`mailto:${settings.email}`}
                    className="underline hover:text-gold"
                  >
                    {settings.email}
                  </a>
                </>
              )}
              . En cas de désaccord, vous pouvez saisir la CNIL —{" "}
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noreferrer noopener"
                className="underline hover:text-gold"
              >
                cnil.fr
              </a>
              .
            </p>
          </section>

          {/* -------------------------------------------------------- cookies */}
          <section className="mt-14">
            <h2 className="display text-2xl">Cookies</h2>
            <p className="mt-5 leading-relaxed text-ink/75">
              Le site ne dépose aucun cookie publicitaire ni traceur de mesure
              d&apos;audience. Les seuls cookies posés servent à vous garder
              connectée à votre espace, ou le salon à son espace de gestion :
              ils sont strictement nécessaires au fonctionnement du site et
              disparaissent à la déconnexion.
            </p>
          </section>

          {/* ------------------------------------------------- médiation */}
          {settings.legal_mediator && (
            <section className="mt-14">
              <h2 className="display text-2xl">Médiation de la consommation</h2>
              <p className="mt-5 leading-relaxed text-ink/75">
                {settings.legal_mediator}
              </p>
            </section>
          )}

          {/* --------------------------------------------- propriété intel. */}
          <section className="mt-14">
            <h2 className="display text-2xl">Propriété intellectuelle</h2>
            <p className="mt-5 leading-relaxed text-ink/75">
              Le nom {settings.shop_name}, son logo et les contenus de ce site
              appartiennent à {settings.legal_name || settings.shop_name}. Toute
              reprise sans accord préalable est interdite.
            </p>
          </section>

          <p className="mt-16 border-t border-line pt-8 text-sm text-mute">
            Une question sur cette page ? Appelez le salon au{" "}
            <a
              href={`tel:${settings.phone.replace(/\s/g, "")}`}
              className="underline hover:text-ink"
            >
              {settings.phone}
            </a>
            .
          </p>
        </div>
      </main>

      <Footer settings={settings} />
    </>
  );
}
