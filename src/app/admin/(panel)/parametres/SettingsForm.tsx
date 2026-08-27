"use client";

import { useActionState } from "react";
import { saveSettings, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "../ui";
import { Flash } from "../Flash";
import type { Settings } from "@/lib/types";

const initial: ActionState = {};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction] = useActionState(saveSettings, initial);

  return (
    <form action={formAction} className="mt-8 space-y-10">
      <fieldset className="border border-ink/12 bg-white p-5">
        <legend className="eyebrow px-2 text-mute">Identité</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Text name="shop_name" label="Nom du salon" settings={settings} required />
          <Text name="tagline" label="Accroche" settings={settings} />
        </div>
        <Area name="about" label="Présentation (page d'accueil)" settings={settings} />
      </fieldset>

      <fieldset className="border border-ink/12 bg-white p-5">
        <legend className="eyebrow px-2 text-mute">Coordonnées</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Text name="address" label="Adresse" settings={settings} />
          <Text name="postal_code" label="Code postal" settings={settings} />
          <Text name="city" label="Ville" settings={settings} />
          <Text name="phone" label="Téléphone" settings={settings} />
          <Text name="email" label="E-mail" settings={settings} type="email" />
          <Text name="instagram" label="Lien Instagram" settings={settings} />
          <Text
            name="google_maps_url"
            label="Lien Google Maps (fiche du salon)"
            settings={settings}
          />
        </div>
      </fieldset>

      <fieldset className="border border-ink/12 bg-white p-5">
        <legend className="eyebrow px-2 text-mute">Espace client & fidélité</legend>
        <p className="text-sm leading-relaxed text-ink/60">
          Le client se connecte par un lien envoyé à l&apos;adresse e-mail
          qu&apos;il a laissée en réservant. Un passage marqué « honoré » vaut
          un tampon ; la récompense est remise par le salon depuis l&apos;onglet
          Clients.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Text
            name="loyalty_threshold"
            label="Passages pour une récompense"
            settings={settings}
            type="number"
          />
          <Text
            name="loyalty_reward"
            label="Récompense"
            settings={settings}
            hint="Ex. : une coupe offerte."
          />
          <Text
            name="no_show_grace_hours"
            label="Délai avant « manqué » (h)"
            settings={settings}
            type="number"
            hint="Temps laissé au salon pour pointer un rendez-vous passé avant qu'il ne bascule automatiquement."
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="client_space_enabled"
              defaultChecked={settings.client_space_enabled !== "0"}
              className="h-4 w-4 accent-black"
            />
            Proposer l&apos;espace client sur le site
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="loyalty_enabled"
              defaultChecked={settings.loyalty_enabled !== "0"}
              className="h-4 w-4 accent-black"
            />
            Activer la carte de fidélité
          </label>
        </div>
      </fieldset>

      <fieldset className="border border-ink/12 bg-white p-5">
        <legend className="eyebrow px-2 text-mute">Avis Google</legend>
        <p className="text-sm leading-relaxed text-ink/60">
          Les avis sont lus directement sur votre fiche Google, affichés tels
          quels et rafraîchis toutes les six heures. Google en met cinq à
          disposition, sans possibilité d&apos;en demander plus ni de les
          trier.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Text
            name="google_place_id"
            label="Identifiant de la fiche (Place ID)"
            settings={settings}
            hint="Se récupère sur le « Place ID Finder » de Google Maps Platform."
          />
          <Text
            name="google_places_api_key"
            label="Clé d'API Google"
            settings={settings}
            hint="Laissez vide si la clé est fournie par la variable d'environnement GOOGLE_PLACES_API_KEY, ce qui est préférable."
          />
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="reviews_enabled"
            defaultChecked={settings.reviews_enabled !== "0"}
            className="h-4 w-4 accent-black"
          />
          Afficher la section « Avis Google » sur le site
        </label>
      </fieldset>

      <fieldset className="border border-ink/12 bg-white p-5">
        <legend className="eyebrow px-2 text-mute">Réservation</legend>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Text
            name="capacity"
            label="Fauteuils simultanés"
            settings={settings}
            type="number"
            hint="Utilisé tant qu'aucun coiffeur n'est enregistré. Ensuite, chaque coiffeur compte pour un fauteuil."
          />
          <Text
            name="slot_step_min"
            label="Pas des créneaux (min)"
            settings={settings}
            type="number"
            hint="15 = créneaux toutes les 15 minutes."
          />
          <Text
            name="min_notice_hours"
            label="Délai minimum (h)"
            settings={settings}
            type="number"
            hint="Réservation impossible en deçà de ce délai."
          />
          <Text
            name="max_advance_days"
            label="Ouverture à l'avance (jours)"
            settings={settings}
            type="number"
            hint="Horizon maximum de réservation."
          />
        </div>
        <Area
          name="booking_notice"
          label="Message affiché avant la confirmation"
          settings={settings}
        />
      </fieldset>

      <div>
        <SubmitButton>Enregistrer</SubmitButton>
        <Flash state={state} />
      </div>
    </form>
  );
}

function Text({
  name,
  label,
  settings,
  type = "text",
  required = false,
  hint,
}: {
  name: string;
  label: string;
  settings: Settings;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-mute">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={settings[name] ?? ""}
        className="mt-2 w-full border border-ink/20 px-3 py-2.5"
      />
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

function Area({
  name,
  label,
  settings,
}: {
  name: string;
  label: string;
  settings: Settings;
}) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-mute">{label}</span>
      <textarea
        name={name}
        rows={4}
        defaultValue={settings[name] ?? ""}
        className="mt-2 w-full border border-ink/20 px-3 py-2.5"
      />
    </label>
  );
}
