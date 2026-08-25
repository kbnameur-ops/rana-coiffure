import {
  getCatalogue,
  getStaff,
  getStaffHours,
  getStaffSkills,
} from "@/lib/queries";
import {
  createStaffAction,
  deleteStaffAction,
  updateStaffAction,
} from "@/app/admin/actions";
import { ConfirmButton, SubmitButton } from "../ui";
import { StaffPlanningForm } from "./StaffCard";
import { CodeForm } from "./CodeForm";
import type { DayInput } from "../WeeklyPlanning";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const [team, catalogue, hours, skills] = await Promise.all([
    getStaff(),
    getCatalogue(),
    getStaffHours(),
    getStaffSkills(),
  ]);

  const services = catalogue.flatMap(({ category, services }) =>
    services.map((s) => ({ ...s, categoryName: category.name })),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="display text-3xl uppercase">Coiffeurs</h1>
          <p className="mt-2 text-ink/60">
            Dès qu&apos;un coiffeur est enregistré, le client peut le choisir au
            moment de réserver. Tant que la liste est vide, la réservation ne
            porte que sur le créneau. Le code d&apos;accès ouvre son espace
            personnel sur /coiffeur.
          </p>
        </div>
        <form action={createStaffAction} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="eyebrow block text-mute">Nom</span>
            <input
              name="name"
              required
              placeholder="Nadia"
              className="mt-1 border border-ink/20 bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="eyebrow block text-mute">Rôle (facultatif)</span>
            <input
              name="role_label"
              placeholder="Coloriste"
              className="mt-1 border border-ink/20 bg-white px-3 py-2"
            />
          </label>
          <SubmitButton>Ajouter</SubmitButton>
        </form>
      </div>

      {team.length === 0 ? (
        <p className="mt-10 border border-ink/12 bg-white p-8 text-ink/60">
          Aucun coiffeur enregistré. Le tunnel de réservation propose
          directement les créneaux, calculés sur les horaires d&apos;ouverture
          et le nombre de fauteuils.
        </p>
      ) : (
        <div className="mt-10 space-y-10">
          {team.map((member) => {
            const own = hours.filter((h) => h.staff_id === member.id);
            const days: DayInput[] = Array.from({ length: 7 }, (_, i) => {
              const ranges = own
                .filter((h) => h.weekday === i + 1)
                .sort((a, b) => a.open_min - b.open_min);
              return {
                open: ranges.length > 0,
                ranges: [
                  ranges[0]
                    ? { from: ranges[0].open_min, to: ranges[0].close_min }
                    : null,
                  ranges[1]
                    ? { from: ranges[1].open_min, to: ranges[1].close_min }
                    : null,
                ],
              };
            });

            return (
              <section key={member.id} className="border border-ink/12 bg-white">
                <header className="flex flex-wrap items-end justify-between gap-3 bg-ink/[0.03] p-4">
                  <form
                    action={updateStaffAction}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="id" value={member.id} />
                    <label className="text-sm">
                      <span className="eyebrow block text-mute">Nom</span>
                      <input
                        name="name"
                        defaultValue={member.name}
                        className="mt-1 border border-ink/20 px-3 py-2 font-semibold"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="eyebrow block text-mute">Rôle</span>
                      <input
                        name="role_label"
                        defaultValue={member.role_label}
                        placeholder="Coloriste"
                        className="mt-1 border border-ink/20 px-3 py-2"
                      />
                    </label>
                    <label className="flex items-center gap-2 pb-2.5 text-sm">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={member.active}
                        className="h-4 w-4 accent-black"
                      />
                      Proposé à la réservation
                    </label>
                    <SubmitButton variant="ghost">Enregistrer</SubmitButton>
                  </form>

                  <form>
                    <input type="hidden" name="id" value={member.id} />
                    <ConfirmButton
                      message={`Retirer ${member.name} de l'équipe ? Ses rendez-vous passés sont conservés.`}
                      formAction={deleteStaffAction}
                    >
                      Retirer
                    </ConfirmButton>
                  </form>
                </header>

                <CodeForm
                  staffId={member.id}
                  hasCode={Boolean(member.access_code_hash)}
                />

                <StaffPlanningForm
                  member={member}
                  days={days}
                  services={services}
                  skills={[...(skills.get(member.id) ?? [])]}
                  hasPlanning={own.length > 0}
                />
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
