import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getStaffById } from "./staff-portal";
import type { Staff } from "./types";

const COOKIE = "salon_staff";
const MAX_AGE = 60 * 60 * 12; // une journée de travail

function secret() {
  const raw =
    process.env.SESSION_SECRET ??
    "dev-secret-a-remplacer-en-production-0123456789";
  return new TextEncoder().encode(`staff:${raw}`);
}

export async function openStaffSession(staffId: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(staffId))
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

export async function closeStaffSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCurrentStaff(): Promise<Staff | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const member = await getStaffById(Number(payload.sub));
    return member && member.active ? member : null;
  } catch {
    return null;
  }
}
