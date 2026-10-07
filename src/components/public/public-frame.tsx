"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicHeader({
  name,
  logo,
  description,
  openLabel,
  open,
}: {
  name: string;
  logo: string;
  description: string;
  openLabel: string;
  open: boolean;
}) {
  return (
    <header className="gz-panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border bg-slate-950 px-4 py-4 text-cyan-50 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-12 rounded-xl object-cover ring-1 ring-cyan-700/60" />
          ) : (
            <div className="grid size-12 place-items-center rounded-xl bg-cyan-400 font-heading text-lg font-bold text-slate-950">{name.slice(0, 1)}</div>
          )}
          <p className="min-w-0 font-heading text-xl font-bold leading-tight sm:text-2xl">{name}</p>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${open ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/40" : "bg-rose-400/15 text-rose-100 ring-1 ring-rose-400/40"}`}>{openLabel}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" className="border-cyan-700 bg-transparent text-cyan-50 hover:bg-white/10 hover:text-cyan-50" asChild>
            <Link href="/login">Staff login</Link>
          </Button>
        </div>
      </div>
      {description ? <p className="px-5 py-3 text-base text-muted-foreground">{description}</p> : null}
    </header>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-6">{children}</main>;
}
