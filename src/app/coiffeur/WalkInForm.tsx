"use client";

import { useActionState } from "react";
import { declareWalkIn, type CoiffeurState } from "./actions";
import { formatPrice } from "@/lib/format";

const initial: CoiffeurState = {};

export function WalkInForm({
  services,
  today,
  now,
}: {
  services: { id: number; name: string; price_cents: number; category: string }[];
  today: string;
  now: string;
}) {
  const [state, formAction, pending] = useActionState(declareWalkIn, initial);

  const byCategory = new Map<string, typeof services>();
  for (const s of services) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  return (
    <form action={formAction} className="mt-6 border border-line bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="eyebrow text-clay">Prestation réalisée</span>
          <select
            name="service_id"
            required
            defaultValue=""
            className="mt-2 w-full border border-ink/20 px-3 py-2.5"
          >
            <option value="" disabled>
              Choisir…
            </option>
            {[...byCategory.entries()].map(([category, list]) => (
              <optgroup key={category} label={category}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatPrice(s.price_cents)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="eyebrow text-clay">Jour</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={today}
            max={today}
            className="mt-2 w-full border border-ink/20 px-3 py-2.5"
          />
        </label>

        <label className="block">
          <span className="eyebrow text-clay">Heure</span>
          {/* Pas de `step` : le navigateur l'ancre sur la valeur initiale, et
              une heure courante comme 08:23 rendait invalide toute saisie
              qui n'était pas un multiple de cinq minutes à partir de là. */}
          <input
            type="time"
            name="heure"
            required
            defaultValue={now}
            className="mt-2 w-full border border-ink/20 px-3 py-2.5"
          />
        </label>

        <label className="block">
          <span className="eyebrow text-clay">Client (facultatif)</span>
          <input
            name="client"
            placeholder="Client de passage"
            className="mt-2 w-full border border-ink/20 px-3 py-2.5"
          />
        </label>

        <label className="block">
          <span className="eyebrow text-clay">Remarque (facultatif)</span>
          <input
            name="notes"
            className="mt-2 w-full border border-ink/20 px-3 py-2.5"
          />
        </label>
      </div>

      {(state.error || state.success) && (
        <p
          role="status"
          className={`mt-5 border-l-2 px-4 py-3 text-sm leading-relaxed ${
            state.error
              ? "border-red-600 bg-red-50 text-red-800"
              : "border-emerald-600 bg-emerald-50 text-emerald-900"
          }`}
        >
          {state.error ?? state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 bg-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-bone transition-colors hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Déclarer la prestation"}
      </button>
    </form>
  );
}
