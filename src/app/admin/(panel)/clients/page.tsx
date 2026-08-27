import { listClients } from "@/lib/clients";
import { getSettings, settingInt } from "@/lib/queries";
import { formatDateLong } from "@/lib/format";
import {
  deleteClientAction,
  redeemLoyaltyAction,
  updateClientBirthdate,
} from "@/app/admin/actions";
import { ConfirmButton, SubmitButton } from "../ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [clients, settings] = await Promise.all([
    listClients(q ?? ""),
    getSettings(),
  ]);

  const threshold = Math.max(1, settingInt(settings, "loyalty_threshold", 10));
  const loyaltyOn = settings.loyalty_enabled !== "0";

  const totalHonoured = clients.reduce((sum, c) => sum + Number(c.honoured), 0);
  const totalMissed = clients.reduce((sum, c) => sum + Number(c.missed), 0);

  return (
    <>
      <h1 className="display text-3xl uppercase">Clients</h1>
      <p className="mt-2 max-w-2xl text-ink/60">
        Une fiche par numéro de téléphone, créée automatiquement à la première
        réservation. Le compteur de fidélité ne retient que les passages
        marqués « honoré ». La date de naissance sert d&apos;identifiant à
        l&apos;espace client : vous pouvez la saisir ici pour un client qui vous
        la donne au comptoir.
      </p>

      <dl className="mt-8 grid gap-px overflow-hidden border border-ink/12 bg-ink/12 sm:grid-cols-3">
        {[
          ["Fiches clients", String(clients.length)],
          ["Passages honorés", String(totalHonoured)],
          ["Rendez-vous manqués", String(totalMissed)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-5">
            <dt className="eyebrow text-mute">{label}</dt>
            <dd className="display mt-2 text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <form className="mt-8 flex flex-wrap items-end gap-3 border border-ink/12 bg-white p-4">
        <label className="grow text-sm sm:max-w-sm">
          <span className="eyebrow block text-mute">Recherche</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nom, téléphone, e-mail"
            className="mt-1 w-full border border-ink/20 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="bg-ink px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-ink-soft"
        >
          Filtrer
        </button>
      </form>

      {clients.length === 0 ? (
        <p className="mt-10 border border-ink/12 bg-white p-8 text-ink/60">
          Aucune fiche client pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-ink/10 border border-ink/12 bg-white">
          {clients.map((client) => {
            const honoured = Number(client.honoured);
            const earned = Math.floor(honoured / threshold);
            const available = Math.max(0, earned - Number(client.redeemed));
            const stamps = available > 0 ? threshold : honoured % threshold;

            return (
              <li key={client.id} className="flex flex-wrap gap-5 p-5">
                <div className="min-w-[14rem] grow">
                  <p className="font-semibold">{client.name || "Sans nom"}</p>
                  <p className="mt-1 text-sm text-mute">
                    <a
                      href={`tel:${client.phone}`}
                      className="underline lining-nums tabular-nums"
                    >
                      {client.phone}
                    </a>
                    {client.email && ` · ${client.email}`}
                  </p>
                  <p className="mt-2 text-sm text-ink/70">
                    {honoured} honoré{honoured > 1 ? "s" : ""}
                    {Number(client.missed) > 0 && (
                      <span className="text-red-700">
                        {" · "}
                        {client.missed} manqué
                        {Number(client.missed) > 1 ? "s" : ""}
                      </span>
                    )}
                    {Number(client.cancelled) > 0 &&
                      ` · ${client.cancelled} annulé${Number(client.cancelled) > 1 ? "s" : ""}`}
                    {Number(client.upcoming) > 0 &&
                      ` · ${client.upcoming} à venir`}
                  </p>
                  <p className="mt-1 text-xs text-mute">
                    {client.last_visit
                      ? `Dernier passage : ${formatDateLong(client.last_visit)}`
                      : "Jamais venu"}
                  </p>

                  <form
                    action={updateClientBirthdate}
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="client_id" value={client.id} />
                    <label className="text-xs">
                      <span className="eyebrow block text-mute">
                        Date de naissance
                      </span>
                      <input
                        type="date"
                        name="birthdate"
                        defaultValue={client.birthdate || ""}
                        className="mt-1 border border-ink/20 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <SubmitButton variant="ghost">Enregistrer</SubmitButton>
                  </form>
                  {!client.birthdate && (
                    <p className="mt-2 text-xs text-gold">
                      Sans date de naissance, ce client ne peut pas ouvrir son
                      espace.
                    </p>
                  )}
                </div>

                {loyaltyOn && (
                  <div className="min-w-[11rem]">
                    <p className="eyebrow text-mute">Fidélité</p>
                    <p className="mt-2 text-sm lining-nums tabular-nums">
                      {stamps} / {threshold}
                    </p>
                    <div className="mt-2 h-1.5 w-full bg-ink/10">
                      <div
                        className="h-full bg-gold"
                        style={{ width: `${(stamps / threshold) * 100}%` }}
                      />
                    </div>
                    {available > 0 && (
                      <p className="mt-2 text-xs font-semibold text-gold">
                        {available} récompense{available > 1 ? "s" : ""} à remettre
                      </p>
                    )}
                  </div>
                )}

                <form className="flex shrink-0 flex-wrap items-start gap-2">
                  <input type="hidden" name="client_id" value={client.id} />
                  {loyaltyOn && available > 0 && (
                    <SubmitButton formAction={redeemLoyaltyAction}>
                      Récompense remise
                    </SubmitButton>
                  )}
                  <ConfirmButton
                    message={`Supprimer la fiche de ${client.name || client.phone} ? Ses rendez-vous restent au planning mais sont anonymisés.`}
                    formAction={deleteClientAction}
                  >
                    Supprimer
                  </ConfirmButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
