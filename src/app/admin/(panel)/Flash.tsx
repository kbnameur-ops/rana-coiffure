"use client";

import type { ActionState } from "@/app/admin/actions";

export function Flash({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      role="status"
      className={`mt-6 border-l-2 px-4 py-3 text-sm ${
        state.error
          ? "border-red-600 bg-red-50 text-red-800"
          : "border-emerald-600 bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
