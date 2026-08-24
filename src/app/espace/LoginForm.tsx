"use client";

import { useActionState } from "react";
import { loginClient, type EspaceState } from "./actions";

const initial: EspaceState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginClient, initial);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="eyebrow text-clay">Votre numéro de téléphone</span>
        <input
          type="tel"
          name="phone"
          required
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          className="mt-2 w-full border border-ink/20 bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-ink"
        />
      </label>

      <label className="block">
        <span className="eyebrow text-clay">Votre date de naissance</span>
        <input
          type="date"
          name="birthdate"
          required
          autoComplete="bday"
          max={new Date().toISOString().slice(0, 10)}
          className="mt-2 w-full border border-ink/20 bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-ink"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-bone transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Vérification…" : "Accéder à mon espace"}
      </button>
    </form>
  );
}
