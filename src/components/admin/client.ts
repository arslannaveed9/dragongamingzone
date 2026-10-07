"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";

export class ApiError extends Error {}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...(init?.body && !(typeof FormData !== "undefined" && init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && body?.error?.code === "UNAUTHORIZED" && !url.includes("/api/auth/login")) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- auth helper is not a component
    window.location.assign("/login");
    throw new ApiError("Sign in required.");
  }
  if (!response.ok) {
    throw new ApiError(body?.error?.message || "Request failed.");
  }
  return body as T;
}

export function usePoll<T>(url: string | null, intervalMs = 10000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  const reload = useCallback(async () => {
    if (!url) return;
    try {
      const next = await api<T>(url);
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // Polling has to start from an effect; the state update happens after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void reload();
    if (!url) return;
    const timer = setInterval(() => void reload(), intervalMs);
    const onRefresh = () => void reload();
    window.addEventListener("gz-refresh", onRefresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("gz-refresh", onRefresh);
    };
  }, [reload, intervalMs, url]);

  return { data, error, loading, reload };
}

export function notifyRefresh() {
  window.dispatchEvent(new Event("gz-refresh"));
}

export function openBooking(preset?: {
  mode?: "walk_in" | "reservation";
  stationId?: string;
  gamingDay?: string;
  startTime?: string;
  bookingId?: string;
}) {
  window.dispatchEvent(new CustomEvent("gz-book", { detail: preset || { mode: "walk_in" } }));
}

export function money(amount: number, symbol = "Rs") {
  return formatMoney(amount, symbol);
}

export function figure(amount: number | null | undefined, symbol = "Rs") {
  if (amount == null) return "••••";
  return formatMoney(amount, symbol);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

export function formatHm(value: string, timeFormat: "12h" | "24h" = "12h") {
  if (timeFormat === "24h") return value;
  const [hourRaw, minute] = value.split(":");
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${suffix}`;
}

export const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  playing: "Playing",
  paused: "Paused",
  reserved: "Reserved",
  disabled: "Disabled",
  maintenance: "Maintenance",
  scheduled: "Scheduled",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  refunded: "Refunded",
};

export function statusClass(status: string) {
  if (status === "available" || status === "paid") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
  if (status === "playing" || status === "active") return "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200";
  if (status === "completed") return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
  if (status === "paused" || status === "reserved" || status === "scheduled" || status === "partial") return "bg-amber-400/20 text-amber-900 dark:text-amber-200";
  if (status === "maintenance") return "bg-violet-500/15 text-violet-800 dark:text-violet-200";
  if (status === "disabled" || status === "cancelled" || status === "no_show" || status === "unpaid" || status === "refunded") return "bg-rose-500/15 text-rose-800 dark:text-rose-200";
  return "bg-muted text-muted-foreground";
}

export const chartTooltip = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 14,
  },
  cursor: { fill: "oklch(1 0 0 / 6%)" },
};
