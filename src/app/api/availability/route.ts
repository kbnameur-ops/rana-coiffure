import { NextResponse } from "next/server";
import { getAvailabilityRange } from "@/lib/availability";
import { getServicesByIds, getSettings, settingInt } from "@/lib/queries";
import { addDays } from "@/lib/format";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // `prestation` accepte une liste — `?prestation=3,7` ou répété — pour les
  // visites qui cumulent plusieurs soins.
  const ids = searchParams
    .getAll("prestation")
    .flatMap((v) => v.split(","))
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const services = await getServicesByIds(ids);
  if (
    services.length === 0 ||
    services.length !== new Set(ids).size ||
    services.some((s) => !s.active || !s.bookable)
  )
    return NextResponse.json({ error: "Prestation inconnue" }, { status: 404 });

  // La durée qui occupe le fauteuil est celle du cumul.
  const durationMin = services.reduce((t, s) => t + s.duration_min, 0);

  const today = todayISO();
  const start = searchParams.get("debut") ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start))
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });

  const count = Math.min(
    Math.max(Number(searchParams.get("jours") ?? 14), 1),
    31,
  );

  const rawStaff = searchParams.get("coiffeur");
  const staffId = rawStaff && rawStaff !== "any" ? Number(rawStaff) : null;

  const [settings, days] = await Promise.all([
    getSettings(),
    getAvailabilityRange(start, count, {
      durationMin,
      serviceIds: services.map((s) => s.id),
      staffId: Number.isFinite(staffId) ? staffId : null,
    }),
  ]);

  return NextResponse.json({
    duration: durationMin,
    priceCents: services.reduce((t, s) => t + s.price_cents, 0),
    maxDate: addDays(today, settingInt(settings, "max_advance_days", 45)),
    days,
  });
}
