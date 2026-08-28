import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import {
  BookingFlow,
  type BookingService,
  type BookingStaff,
  type DayAvailability,
} from "@/components/booking/BookingFlow";
import {
  getCatalogue,
  getSettings,
  getStaff,
  getStaffSkills,
  settingInt,
} from "@/lib/queries";
import { getAvailabilityRange } from "@/lib/availability";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réserver un rendez-vous",
  description:
    "Choisissez votre prestation, votre créneau et confirmez votre rendez-vous en ligne en moins d'une minute.",
};

export default async function ReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ prestation?: string }>;
}) {
  const params = await searchParams;
  const [settings, catalogue, team, skills] = await Promise.all([
    getSettings(),
    getCatalogue(true),
    getStaff(true),
    getStaffSkills(),
  ]);

  const staff: BookingStaff[] = team.map((member) => ({
    id: member.id,
    name: member.name,
    role_label: member.role_label,
    serviceIds: [...(skills.get(member.id) ?? [])],
  }));

  const services: BookingService[] = catalogue.flatMap(({ category, services }) =>
    services
      .filter((s) => s.bookable)
      .map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price_cents: s.price_cents,
        duration_min: s.duration_min,
        category: category.name,
        categoryImage: category.image,
      })),
  );

  const today = todayISO();

  // `?prestation=3,7` : la carte peut envoyer plusieurs soins d'un coup.
  const initialServices = (params.prestation ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is BookingService => s !== undefined);
  const initialServiceIds = initialServices.map((s) => s.id);

  // Prestations choisies depuis la carte : les 14 premiers jours sont rendus
  // côté serveur, l'étape « créneau » s'affiche donc déjà remplie.
  const initialDays: DayAvailability[] = initialServices.length
    ? await getAvailabilityRange(today, 14, {
        durationMin: initialServices.reduce((t, s) => t + s.duration_min, 0),
        serviceIds: initialServiceIds,
        staffId: null,
      })
    : [];

  return (
    <>
      <Header
        shopName={settings.shop_name}
        phone={settings.phone}
        hasTeam={staff.length > 0}
        hasReviews={false}
        hasClientSpace={settings.client_space_enabled !== "0"}
      />

      <main className="bg-porcelain pt-28 pb-24 sm:pt-32">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <p className="eyebrow text-mute">Rendez-vous</p>
          <h1 className="display mt-4 text-[clamp(2.25rem,6vw,3.75rem)] uppercase">
            Réserver
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink/70">
            {staff.length ? "Cinq" : "Quatre"} étapes, aucune inscription. Le
            créneau est bloqué dès la confirmation.
          </p>

          <div className="mt-14">
            {services.length === 0 ? (
              <p className="border border-ink/10 bg-white p-6 text-ink/70">
                La réservation en ligne est momentanément indisponible. Appelez
                le salon au{" "}
                <a
                  className="underline"
                  href={`tel:${settings.phone.replace(/\s/g, "")}`}
                >
                  {settings.phone}
                </a>
                .
              </p>
            ) : (
              <BookingFlow
                services={services}
                staff={staff}
                today={today}
                notice={settings.booking_notice}
                phone={settings.phone}
                maxAdvanceDays={settingInt(settings, "max_advance_days", 45)}
                initialServiceIds={initialServiceIds}
                initialDays={initialDays}
              />
            )}
          </div>
        </div>
      </main>

      <Footer settings={settings} />
    </>
  );
}
