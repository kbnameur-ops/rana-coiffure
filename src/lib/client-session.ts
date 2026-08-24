import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getClientById, type Client } from "./clients";

const COOKIE = "salon_client";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 jours

function secret() {
  const raw =
    process.env.SESSION_SECRET ??
    "dev-secret-a-remplacer-en-production-0123456789";
  return new TextEncoder().encode(`client:${raw}`);
}

export async function openClientSession(clientId: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(clientId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function closeClientSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCurrentClient(): Promise<Client | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const client = await getClientById(Number(payload.sub));
    return client ?? null;
  } catch {
    return null;
  }
}
