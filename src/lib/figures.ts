import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const FIGURES_COOKIE = "gz_figures";
const MAX_AGE = 60 * 60 * 8;

function secretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

export async function setFiguresCookie() {
  const key = secretKey();
  if (!key) throw new Error("AUTH_SECRET must be at least 16 characters.");
  const token = await new SignJWT({ kind: "figures" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
  const jar = await cookies();
  jar.set(FIGURES_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearFiguresCookie() {
  const jar = await cookies();
  jar.set(FIGURES_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function figuresUnlocked(): Promise<boolean> {
  const key = secretKey();
  if (!key) return false;
  const token = (await cookies()).get(FIGURES_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.kind === "figures";
  } catch {
    return false;
  }
}
