"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticateStaff, addWalkIn } from "@/lib/staff-portal";
import {
  closeStaffSession,
  getCurrentStaff,
  openStaffSession,
} from "@/lib/staff-session";
import { timeToMinutes } from "@/lib/format";

export type CoiffeurState = { error?: string; success?: string };

export async function loginStaff(
  _prev: CoiffeurState,
  formData: FormData,
): Promise<CoiffeurState> {
  const staffId = Number(formData.get("staff_id"));
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!staffId || !code)
    return { error: "Choisissez votre nom et saisissez votre code." };

  const result = await authenticateStaff(staffId, code);
  if (!result.ok) {
    if (result.reason === "bloque")
      return {
        error: `Trop de tentatives. Réessayez dans ${result.minutes} minutes.`,
      };
    if (result.reason === "sans-code")
      return {
        error:
          "Aucun code n'a encore été créé pour vous. Demandez-le au responsable du salon.",
      };
    return { error: "Code incorrect." };
  }

  await openStaffSession(result.staffId);
  redirect("/coiffeur");
}

export async function logoutStaff() {
  await closeStaffSession();
  redirect("/coiffeur");
}

export async function declareWalkIn(
  _prev: CoiffeurState,
  formData: FormData,
): Promise<CoiffeurState> {
  const member = await getCurrentStaff();
  if (!member) return { error: "Session expirée, reconnectez-vous." };

  const serviceId = Number(formData.get("service_id"));
  const date = String(formData.get("date") ?? "");
  const heure = String(formData.get("heure") ?? "");
  if (!serviceId) return { error: "Choisissez une prestation." };
  if (!heure) return { error: "Indiquez l'heure de la prestation." };

  const result = await addWalkIn({
    staffId: member.id,
    serviceId,
    date,
    startMin: timeToMinutes(heure),
    customerName: String(formData.get("client") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/coiffeur");
  revalidatePath("/admin");
  return {
    success:
      "Prestation enregistrée. Elle apparaîtra dans vos totaux une fois validée par le salon.",
  };
}
