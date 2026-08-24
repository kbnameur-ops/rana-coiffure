"use client";

import { useActionState } from "react";
import { saveOpeningHours, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "../ui";
import { Flash } from "../Flash";
import { WeeklyPlanning, type DayInput } from "../WeeklyPlanning";

const initial: ActionState = {};

export function HoursForm({ days }: { days: DayInput[] }) {
  const [state, formAction] = useActionState(saveOpeningHours, initial);

  return (
    <form action={formAction} className="mt-8 border border-ink/12 bg-white">
      {/* Les champs ne sont pas contrôlés : la grille est remontée dès que la
          donnée enregistrée change, sinon elle afficherait l'état précédent. */}
      <WeeklyPlanning key={JSON.stringify(days)} days={days} />
      <div className="border-t border-ink/12 p-4">
        <SubmitButton>Enregistrer les horaires</SubmitButton>
        <Flash state={state} />
      </div>
    </form>
  );
}
