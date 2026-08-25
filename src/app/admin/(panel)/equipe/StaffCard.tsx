"use client";

import { useActionState } from "react";
import { saveStaffPlanning, type ActionState } from "@/app/admin/actions";
import { SubmitButton } from "../ui";
import { Flash } from "../Flash";
import { WeeklyPlanning, type DayInput } from "../WeeklyPlanning";
import type { Staff } from "@/lib/types";

type SkillOption = { id: number; name: string; categoryName: string };

const initial: ActionState = {};

export function StaffPlanningForm({
  member,
  days,
  services,
  skills,
  hasPlanning,
}: {
  member: Staff;
  days: DayInput[];
  services: SkillOption[];
  skills: number[];
  hasPlanning: boolean;
}) {
  const [state, formAction] = useActionState(saveStaffPlanning, initial);
  const byCategory = new Map<string, SkillOption[]>();
  for (const s of services) {
    const list = byCategory.get(s.categoryName) ?? [];
    list.push(s);
    byCategory.set(s.categoryName, list);
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="staff_id" value={member.id} />

      <div className="border-t border-ink/12">
        <p className="eyebrow px-4 pt-4 text-mute">Disponibilité de la semaine</p>
        <p className="px-4 pt-2 text-sm text-ink/60">
          {hasPlanning
            ? "Ce planning prime sur les horaires d'ouverture du salon."
            : "Aucun planning : ce coiffeur suit les horaires d'ouverture du salon. Cochez des jours pour lui en donner un."}
        </p>
        {/* Remontée quand la donnée enregistrée change : les champs ne sont
            pas contrôlés et garderaient sinon l'état précédent. */}
        <WeeklyPlanning
          key={JSON.stringify(days)}
          days={days}
          fallbackNote="Ne travaille pas"
        />
      </div>

      <div className="border-t border-ink/12 p-4">
        <p className="eyebrow text-mute">Compétences</p>
        <p className="mt-2 text-sm text-ink/60">
          Aucune case cochée : ce coiffeur assure toutes les prestations.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {[...byCategory.entries()].map(([category, list]) => (
            <div key={category}>
              <p className="text-xs font-semibold uppercase tracking-wider text-mute">
                {category}
              </p>
              <ul className="mt-2 space-y-1.5">
                {list.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="skill"
                        value={s.id}
                        defaultChecked={skills.includes(s.id)}
                        className="mt-0.5 h-4 w-4 accent-black"
                      />
                      {s.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-ink/12 p-4">
        <SubmitButton>Enregistrer le planning</SubmitButton>
        <Flash state={state} />
      </div>
    </form>
  );
}
