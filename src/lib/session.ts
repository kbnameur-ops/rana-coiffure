import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./auth";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}
