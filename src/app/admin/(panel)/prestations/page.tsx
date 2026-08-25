import { getCategories, getServices } from "@/lib/queries";
import {
  createCategory,
  createService,
  deleteCategory,
  deleteService,
  moveCategory,
  moveService,
  renameCategory,
  updateService,
} from "@/app/admin/actions";
import { ConfirmButton, SubmitButton } from "../ui";
import type { Category, Service } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PrestationsPage() {
  const [categories, services] = await Promise.all([
    getCategories(),
    getServices(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl uppercase">Prestations &amp; tarifs</h1>
          <p className="mt-2 text-ink/60">
            Toute modification est visible immédiatement sur le site et dans le
            tunnel de réservation.
          </p>
        </div>
        <form action={createCategory} className="flex items-end gap-2">
          <label className="text-sm">
            <span className="eyebrow block text-mute">Nouvelle catégorie</span>
            <input
              name="name"
              required
              placeholder="Ex. Enfants"
              className="mt-1 border border-ink/20 bg-white px-3 py-2"
            />
          </label>
          <SubmitButton>Ajouter</SubmitButton>
        </form>
      </div>

      <div className="mt-10 space-y-12">
        {categories.map((category, index) => (
          <CategoryBlock
            key={category.id}
            category={category}
            categories={categories}
            services={services.filter((s) => s.category_id === category.id)}
            first={index === 0}
            last={index === categories.length - 1}
          />
        ))}
      </div>

      {categories.length === 0 && (
        <p className="mt-10 border border-ink/12 bg-white p-8 text-ink/60">
          Créez une première catégorie pour commencer (Coupe, Couleur, Soins…).
        </p>
      )}
    </>
  );
}

function CategoryBlock({
  category,
  categories,
  services,
  first,
  last,
}: {
  category: Category;
  categories: Category[];
  services: Service[];
  first: boolean;
  last: boolean;
}) {
  return (
    <section className="border border-ink/12 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/12 bg-ink/[0.03] p-4">
        <form action={renameCategory} className="flex items-center gap-2">
          <input type="hidden" name="id" value={category.id} />
          <input
            name="name"
            defaultValue={category.name}
            className="display border border-transparent bg-transparent px-2 py-1 text-lg uppercase hover:border-ink/20 focus:border-ink focus:outline-none"
          />
          <SubmitButton variant="ghost">Renommer</SubmitButton>
        </form>

        <form className="flex gap-2">
          <input type="hidden" name="id" value={category.id} />
          {!first && (
            <SubmitButton variant="ghost" formAction={moveCategory.bind(null, -1)}>
              ↑
            </SubmitButton>
          )}
          {!last && (
            <SubmitButton variant="ghost" formAction={moveCategory.bind(null, 1)}>
              ↓
            </SubmitButton>
          )}
          <ConfirmButton
            message={`Supprimer la catégorie « ${category.name} » et ses ${services.length} prestation(s) ?`}
            formAction={deleteCategory}
          >
            Supprimer
          </ConfirmButton>
        </form>
      </header>

      <ul className="divide-y divide-ink/10">
        {services.map((service, i) => (
          <li key={service.id} className="p-4">
            <ServiceRow
              service={service}
              categories={categories}
              first={i === 0}
              last={i === services.length - 1}
            />
          </li>
        ))}
        {services.length === 0 && (
          <li className="p-4 text-sm text-mute">Aucune prestation pour l&apos;instant.</li>
        )}
      </ul>

      <form action={createService} className="border-t border-ink/12 bg-ink/[0.02] p-4">
        <input type="hidden" name="category_id" value={category.id} />
        <p className="eyebrow text-mute">Ajouter une prestation</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_2fr_auto_auto_auto]">
          <input
            name="name"
            required
            placeholder="Nom"
            className="border border-ink/20 px-3 py-2"
          />
          <input
            name="description"
            placeholder="Description (facultatif)"
            className="border border-ink/20 px-3 py-2"
          />
          <input
            name="price"
            required
            inputMode="decimal"
            placeholder="Prix €"
            className="w-24 border border-ink/20 px-3 py-2"
          />
          <input
            name="duration"
            required
            type="number"
            min={5}
            step={5}
            defaultValue={30}
            className="w-24 border border-ink/20 px-3 py-2"
          />
          <SubmitButton>Ajouter</SubmitButton>
        </div>
      </form>
    </section>
  );
}

function ServiceRow({
  service,
  categories,
  first,
  last,
}: {
  service: Service;
  categories: Category[];
  first: boolean;
  last: boolean;
}) {
  return (
    <form action={updateService} className="grid gap-3">
      <input type="hidden" name="id" value={service.id} />

      <div className="grid gap-3 sm:grid-cols-[1.4fr_2fr_auto_auto]">
        <input
          name="name"
          defaultValue={service.name}
          required
          className="border border-ink/20 px-3 py-2 font-semibold"
        />
        <input
          name="description"
          defaultValue={service.description}
          placeholder="Description"
          className="border border-ink/20 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2">
          <input
            name="price"
            defaultValue={(service.price_cents / 100).toString().replace(".", ",")}
            inputMode="decimal"
            className="w-24 border border-ink/20 px-3 py-2 text-right lining-nums tabular-nums"
          />
          <span className="text-sm text-mute">€</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            name="duration"
            type="number"
            min={5}
            step={5}
            defaultValue={service.duration_min}
            className="w-24 border border-ink/20 px-3 py-2 text-right lining-nums tabular-nums"
          />
          <span className="text-sm text-mute">min</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-mute">Catégorie</span>
          <select
            name="category_id"
            defaultValue={service.category_id ?? ""}
            className="border border-ink/20 px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={service.active}
            className="h-4 w-4 accent-black"
          />
          Visible sur le site
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="bookable"
            defaultChecked={service.bookable}
            className="h-4 w-4 accent-black"
          />
          Réservable en ligne
        </label>

        <span className="grow" />

        <SubmitButton>Enregistrer</SubmitButton>
        {!first && (
          <SubmitButton variant="ghost" formAction={moveService.bind(null, -1)}>
            ↑
          </SubmitButton>
        )}
        {!last && (
          <SubmitButton variant="ghost" formAction={moveService.bind(null, 1)}>
            ↓
          </SubmitButton>
        )}
        <ConfirmButton
          message={`Supprimer « ${service.name} » ?`}
          formAction={deleteService}
        >
          Supprimer
        </ConfirmButton>
      </div>
    </form>
  );
}
