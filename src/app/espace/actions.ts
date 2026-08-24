"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSql } from "@/lib/db";
import { authenticateClient, deleteClientData } from "@/lib/clients";
import {
  closeClientSession,
  getCurrentClient,
  openClientSession,
} from "@/lib/client-session";
import { nowMinutes, todayISO } from "@/lib/time";

export type EspaceState = { error?: string; success?: string };

export async function loginClient(
  _prev: EspaceState,
  formData: FormData,
): Promise<EspaceState> {
  const phone = String(formData.get("phone") ?? "");
  const birthdate = String(formData.get("birthdate") ?? "");

  if (!phone.trim() || !birthdate)
    return { error: "Renseignez votre numéro et votre date de naissance." };

  const result = await authenticateClient(phone, birthdate);

  if (!result.ok) {
    if (result.reason === "bloque")
      return {
        error: `Trop de tentatives. Réessayez dans ${result.minutes} minutes, ou appelez le salon.`,
      };
    // Message unique : il ne doit pas être possible de savoir si un numéro
    // est celui d'un client en tâtonnant.
    return {
      error:
        "Numéro ou date de naissance incorrects. Si vous n'avez jamais donné votre date de naissance au salon, elle vous sera demandée lors de votre prochaine réservation.",
    };
  }

  await openClientSession(result.clientId);
  redirect("/espace");
}

export async function logoutClient() {
  await closeClientSession();
  redirect("/espace");
}

/**
 * Annulation par le client : possible tant que l'heure du rendez-vous n'est
 * pas passée. Ensuite, l'absence est comptée comme telle.
 */
export async function cancelMyBooking(
  _prev: EspaceState,
  formData: FormData,
): Promise<EspaceState> {
  const client = await getCurrentClient();
  if (!client) return { error: "Session expirée, reconnectez-vous." };

  const id = Number(formData.get("id"));
  if (!id) return { error: "Rendez-vous introuvable." };

  const sql = await getSql();
  const [booking] = await sql.query<{
    date: string;
    start_min: number;
    status: string;
  }>("SELECT date, start_min, status FROM bookings WHERE id = $1 AND client_id = $2", [
    id,
    client.id,
  ]);

  if (!booking) return { error: "Rendez-vous introuvable." };
  if (booking.status !== "confirmed")
    return { error: "Ce rendez-vous n'est plus annulable." };

  const today = todayISO();
  const passed =
    booking.date < today ||
    (booking.date === today && booking.start_min <= nowMinutes());
  if (passed)
    return {
      error:
        "L'heure du rendez-vous est passée : il ne peut plus être annulé en ligne. Appelez le salon.",
    };

  await sql.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);
  revalidatePath("/espace");
  revalidatePath("/admin");
  return { success: "Rendez-vous annulé. Le salon en est informé." };
}

export async function deleteMyAccount() {
  const client = await getCurrentClient();
  if (!client) redirect("/espace");
  await deleteClientData(client.id);
  await closeClientSession();
  redirect("/espace?efface=1");
}
