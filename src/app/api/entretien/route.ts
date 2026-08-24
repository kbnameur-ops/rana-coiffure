import { NextResponse, type NextRequest } from "next/server";
import { sweepNoShows } from "@/lib/clients";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Entretien quotidien, déclenché par la tâche planifiée de l'hébergeur :
 * bascule des rendez-vous oubliés en « manqué » et purge des jetons de
 * connexion périmés. L'espace salon fait déjà le premier travail à chaque
 * visite ; cette route garantit qu'il a lieu même sans personne devant.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const missed = await sweepNoShows();

  const sql = await getSql();
  const purged = await sql.query<{ id: number }>(
    "DELETE FROM client_tokens WHERE expires_at < $1 RETURNING id",
    [new Date().toISOString()],
  );

  return NextResponse.json({
    rendezVousManques: missed,
    jetonsPurges: purged.length,
  });
}
