"use client";

import { useActionState } from "react";
import { submitPasswordReset, type ActionState } from "@/app/admin/actions";

const initial: ActionState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    submitPasswordReset,
    initial,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="jeton" value={token} />

      {[
        ["password", "Nouveau mot de passe"],
        ["confirm", "Confirmation"],
      ].map(([name, label]) => (
        <label key={name} className="block">
          <span className="eyebrow text-cream/60">{label}</span>
          <input
            type="password"
            name={name}
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-2 w-full border border-ink-line bg-ink-soft px-4 py-3 text-cream outline-none transition-colors focus:border-terracotta-soft"
          />
        </label>
      ))}

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
        className="w-full bg-terracotta px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-ink disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Choisir ce mot de passe"}
      </button>
    </form>
  );
}
