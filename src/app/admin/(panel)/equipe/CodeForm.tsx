"use client";

import { useActionState } from "react";
import { regenerateStaffCode, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "../ui";
import { Flash } from "../Flash";

const initial: ActionState = {};

export function CodeForm({
  staffId,
  hasCode,
}: {
  staffId: number;
  hasCode: boolean;
}) {
  const [state, formAction] = useActionState(regenerateStaffCode, initial);

  return (
    <form action={formAction} className="border-t border-ink/12 p-4">
      <input type="hidden" name="staff_id" value={staffId} />
      <p className="eyebrow text-mute">Accès à l&apos;espace coiffeur</p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
        {hasCode
          ? "Un code est actif. En générer un nouveau annule le précédent."
          : "Aucun code : ce coiffeur ne peut pas encore ouvrir son espace."}{" "}
        Le code s&apos;affiche une seule fois, à sa création.
      </p>
      <div className="mt-4">
        <SubmitButton variant={hasCode ? "ghost" : "primary"}>
          {hasCode ? "Générer un nouveau code" : "Créer un code"}
        </SubmitButton>
      </div>
      <Flash state={state} />
    </form>
  );
}
