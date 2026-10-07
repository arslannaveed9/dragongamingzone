"use client";

import { useEffect, useState } from "react";

export function Countdown({
  endAt,
  paused,
  remainingMs,
  serverNow,
}: {
  endAt: string;
  paused?: boolean;
  remainingMs: number;
  serverNow: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [paused, endAt]);

  const current = now ?? Date.parse(serverNow);
  const rawMs = paused ? remainingMs : Date.parse(endAt) - current;
  const overtime = !paused && rawMs < 0;
  const totalSeconds = Math.floor(Math.abs(rawMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
  const urgent = !paused && !overtime && totalSeconds <= 5 * 60;
  const tone = paused
    ? "bg-violet-600 text-white ring-violet-300"
    : overtime
      ? "gz-pulse bg-rose-600 text-white ring-rose-300"
      : urgent
        ? "bg-rose-600 text-white ring-rose-300"
        : totalSeconds <= 15 * 60
          ? "bg-amber-400 text-amber-950 ring-amber-200"
          : "bg-emerald-500 text-white ring-emerald-300";
  const note = paused ? "Paused" : overtime ? "Over" : urgent ? "Ending" : "Left";

  return (
    <span className={`inline-flex max-w-full flex-wrap items-baseline gap-2 rounded-xl px-3 py-2 font-heading text-2xl font-bold tabular-nums shadow-md ring-2 sm:px-3.5 sm:text-3xl ${tone}`}>
      {overtime ? `+${label}` : label}
      <span className="text-xs font-semibold tracking-wide uppercase">{note}</span>
    </span>
  );
}
