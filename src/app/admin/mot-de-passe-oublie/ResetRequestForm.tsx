"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ActionState } from "@/app/admin/actions";

const initial: ActionState = {};

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initial,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="eyebrow text-cream/60">Adresse e-mail du compte</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          className="mt-2 w-full border border-ink-line bg-ink-soft px-4 py-3 text-cream outline-none transition-colors focus:border-gold-soft"
        />
      </label>

      {(state.error || state.success) && (
        <p
          role="status"
          className={`border-l-2 px-4 py-3 text-sm leading-relaxed ${
            state.error
              ? "border-red-500 bg-ink-soft text-cream/80"
              : "border-emerald-500 bg-ink-soft text-cream/80"
          }`}
        >
          {state.error ?? state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gold px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-ink disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Recevoir un lien"}
      </button>
    </form>
  );
}
