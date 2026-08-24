"use client";

import { useActionState } from "react";
import { login, type ActionState } from "../actions";

const initial: ActionState = {};

export function LoginForm({ suite }: { suite: string }) {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <form action={formAction} className="mt-10 space-y-5">
      <input type="hidden" name="suite" value={suite} />

      <label className="block">
        <span className="eyebrow text-clay">E-mail</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          className="mt-2 w-full border border-ink-line bg-ink-soft px-4 py-3 text-bone outline-none transition-colors focus:border-gold"
        />
      </label>

      <label className="block">
        <span className="eyebrow text-clay">Mot de passe</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full border border-ink-line bg-ink-soft px-4 py-3 text-bone outline-none transition-colors focus:border-gold"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gold-soft px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-light disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
