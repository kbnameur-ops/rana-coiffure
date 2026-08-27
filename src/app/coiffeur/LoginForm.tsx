"use client";

import { useActionState } from "react";
import { loginStaff, type CoiffeurState } from "./actions";

const initial: CoiffeurState = {};

export function LoginForm({
  team,
}: {
  team: { id: number; name: string; role_label: string }[];
}) {
  const [state, formAction, pending] = useActionState(loginStaff, initial);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="eyebrow text-cream/60">Votre nom</span>
        <select
          name="staff_id"
          required
          defaultValue=""
          className="mt-2 w-full border border-ink-line bg-ink-soft px-4 py-3.5 text-cream outline-none transition-colors focus:border-gold-soft"
        >
          <option value="" disabled>
            Choisir…
          </option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.role_label ? ` — ${m.role_label}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow text-cream/60">Votre code</span>
        <input
          name="code"
          required
          autoComplete="one-time-code"
          spellCheck={false}
          className="mt-2 w-full border border-ink-line bg-ink-soft px-4 py-3.5 text-lg uppercase tracking-[0.3em] text-cream outline-none transition-colors focus:border-gold-soft"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="border-l-2 border-red-500 bg-ink-soft px-4 py-3 text-sm leading-relaxed text-cream/80"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gold px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-ink disabled:opacity-60"
      >
        {pending ? "Vérification…" : "Entrer"}
      </button>
    </form>
  );
}
