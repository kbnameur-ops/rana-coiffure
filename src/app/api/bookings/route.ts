import { NextResponse } from "next/server";
import { createBooking } from "@/lib/availability";

export const dynamic = "force-dynamic";

/** Le tunnel envoie un tableau ; on tolère un identifiant seul par sécurité. */
function normaliseIds(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const result = await createBooking({
    serviceIds: normaliseIds(body.serviceIds ?? body.serviceId),
    staffId:
      body.staffId === null || body.staffId === undefined
        ? null
        : Number(body.staffId),
    date: String(body.date ?? ""),
    startMin: Number(body.startMin),
    customerName: String(body.customerName ?? ""),
    phone: String(body.phone ?? ""),
    email: body.email ? String(body.email) : "",
    birthdate: body.birthdate ? String(body.birthdate) : "",
    notes: body.notes ? String(body.notes) : "",
  });

  if (!result.ok)
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.code === "validation" ? 400 : 409 },
    );
  return NextResponse.json({ ref: result.ref, staffName: result.staffName });
}
