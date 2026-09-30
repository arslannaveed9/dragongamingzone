import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import type { Permission } from "@/lib/permissions";
import { zodMessage } from "@/lib/validators";
import type { Actor } from "@/services/auth-service";
import { requireActor } from "@/services/auth-service";
import { sweepExpiredSessions } from "@/services/sweep-service";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }
  if (error instanceof ZodError || (error instanceof Error && error.name === "ZodError")) {
    return json({ error: { code: "VALIDATION", message: error instanceof ZodError ? zodMessage(error) : error.message } }, 400);
  }
  if (typeof error === "object" && error && "code" in error && (error as { code?: number }).code === 11000) {
    return json({ error: { code: "DUPLICATE", message: "That value is already in use." } }, 409);
  }
  console.error(error);
  return json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, 500);
}

export async function authed<T>(
  permission: Permission,
  handler: (actor: Actor) => Promise<T>,
  options?: { sweep?: boolean },
) {
  try {
    const actor = await requireActor(permission);
    if (options?.sweep) await sweepExpiredSessions();
    return json(await handler(actor));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function open<T>(handler: () => Promise<T>) {
  try {
    return json(await handler());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "VALIDATION", "Invalid request body.");
  }
}

export function pageParams(url: URL, defaultSize = 25) {
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || defaultSize) || defaultSize));
  return { page, pageSize };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
