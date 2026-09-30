import { SignJWT, jwtVerify } from "jose";
import { isRole, type Role } from "@/lib/permissions";

export const SESSION_COOKIE = "gz_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;

export type SessionPayload = {
  sub: string;
  role: Role;
  name: string;
  email: string;
};

function secretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const key = secretKey();
  if (!key) {
    throw new Error("AUTH_SECRET must be at least 16 characters.");
  }
  return new SignJWT({
    role: payload.role,
    name: payload.name,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    const role = typeof payload.role === "string" ? payload.role : "";
    if (!payload.sub || !isRole(role)) return null;
    return {
      sub: payload.sub,
      role,
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
