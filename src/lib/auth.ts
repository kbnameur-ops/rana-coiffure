import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "salon_session";
const MAX_AGE = 60 * 60 * 8; // 8 h

function secret() {
  const raw =
    process.env.SESSION_SECRET ??
    "dev-secret-a-remplacer-en-production-0123456789";
  return new TextEncoder().encode(raw);
}

export type SessionPayload = { sub: string; email: string };

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE;
