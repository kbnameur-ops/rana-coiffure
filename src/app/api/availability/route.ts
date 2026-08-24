import { NextResponse } from "next/server";
import { getAvailabilityRange } from "@/lib/availability";
import { getService, getSettings, settingInt } from "@/lib/queries";
import { addDays } from "@/lib/format";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const service = await getService(Number(searchParams.get("prestation")));
  if (!service || !service.active || !service.bookable)
    return NextResponse.json({ error: "Prestation inconnue" }, { status: 404 });

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
      durationMin: service.duration_min,
      serviceId: service.id,
      staffId: Number.isFinite(staffId) ? staffId : null,
    }),
  ]);

  return NextResponse.json({
    duration: service.duration_min,
    maxDate: addDays(today, settingInt(settings, "max_advance_days", 45)),
    days,
  });
}
