"use client";

import { useActionState } from "react";
import { cancelMyBooking, type EspaceState } from "./actions";

const initial: EspaceState = {};

export function CancelButton({ id, label }: { id: number; label: string }) {
  const [state, formAction, pending] = useActionState(cancelMyBooking, initial);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Annuler votre rendez-vous du ${label} ?`))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="border border-ink/25 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      >
        {pending ? "Annulation…" : "Annuler"}
      </button>
      {(state.error || state.success) && (
        <p
          role="status"
          className={`mt-3 text-sm ${state.error ? "text-red-700" : "text-emerald-700"}`}
        >
          {state.error ?? state.success}
        </p>
      )}
    </form>
  );
}
