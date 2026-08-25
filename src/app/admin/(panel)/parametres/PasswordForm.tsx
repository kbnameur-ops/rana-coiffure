"use client";

import { useActionState } from "react";
import { changePassword, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "../ui";
import { Flash } from "../Flash";

const initial: ActionState = {};

export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, initial);

  return (
    <form action={formAction} className="mt-6 border border-ink/12 bg-white p-5">
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          ["current", "Mot de passe actuel", "current-password"],
          ["next", "Nouveau mot de passe", "new-password"],
          ["confirm", "Confirmation", "new-password"],
        ].map(([name, label, autoComplete]) => (
          <label key={name} className="block">
            <span className="eyebrow text-mute">{label}</span>
            <input
              type="password"
              name={name}
              required
              autoComplete={autoComplete}
              className="mt-2 w-full border border-ink/20 px-3 py-2.5"
            />
          </label>
        ))}
      </div>
      <div className="mt-5">
        <SubmitButton>Changer le mot de passe</SubmitButton>
        <Flash state={state} />
      </div>
    </form>
  );
}
