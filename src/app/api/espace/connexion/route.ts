import { NextResponse } from "next/server";
import { authenticateClient } from "@/lib/clients";
import { openClientSession, getCurrentClient } from "@/lib/client-session";
import { getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Connexion à l'espace client depuis le tunnel de réservation : la cliente
 * s'identifie, ses coordonnées remplissent le formulaire et le rendez-vous
 * rejoint son historique. Mêmes identifiants et même limitation de tentatives
 * que sur /espace — c'est la même porte, ouverte à un autre endroit.
 */
export async function POST(request: Request) {
  const settings = await getSettings();
  if (settings.client_space_enabled === "0")
    return NextResponse.json(
      { error: "L'espace client est désactivé." },
      { status: 404 },
    );

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const phone = String(body.phone ?? "");
  const birthdate = String(body.birthdate ?? "");
  if (!phone.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate))
    return NextResponse.json(
      { error: "Renseignez votre numéro et votre date de naissance." },
      { status: 400 },
    );

  const result = await authenticateClient(phone, birthdate);

  if (!result.ok) {
    if (result.reason === "bloque")
      return NextResponse.json(
        {
          error: `Trop de tentatives. Réessayez dans ${result.minutes} minutes, ou renseignez vos coordonnées à la place.`,
        },
        { status: 429 },
      );
    // Message unique : on ne doit pas pouvoir découvrir qu'un numéro est
    // celui d'une cliente en tâtonnant.
    return NextResponse.json(
      {
        error:
          "Numéro ou date de naissance incorrects. Si le salon n'a jamais eu votre date de naissance, renseignez simplement vos coordonnées à la place.",
      },
      { status: 401 },
    );
  }

  await openClientSession(result.clientId);
  const client = await getCurrentClient();

  return NextResponse.json({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    birthdate: client?.birthdate ?? "",
  });
}
