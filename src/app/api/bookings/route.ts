import { NextResponse } from "next/server";
import { createBooking } from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const result = await createBooking({
    serviceId: Number(body.serviceId),
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
