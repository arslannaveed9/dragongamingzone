"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePoll } from "@/components/admin/client";
import { ThemeToggle } from "@/components/theme-toggle";

type Live = {
  withinHours: boolean;
  closedGap: boolean;
  settings: { business: { name: string; logoDataUrl: string } };
};

function linksFor(home: boolean, showGallery: boolean) {
  return [
    [home ? "#floor" : "/#floor", "Stations"],
    [home ? "#schedule" : "/#schedule", "Today"],
    ...(showGallery ? [[home ? "#gallery" : "/#gallery", "Gallery"]] : []),
    ["/tournaments", "Tournaments"],
    ["/blog", "Blog"],
    [home ? "#visit" : "/#visit", "Visit"],
  ];
}

function NavLinks({ home, showGallery, className }: { home: boolean; showGallery: boolean; className: string }) {
  return (
    <nav className={className}>
      {linksFor(home, showGallery).map(([href, label]) =>
        href.includes("#") ? (
          <a key={label} href={href} className="shrink-0 rounded-lg px-3 py-2 text-sm text-cyan-100 hover:bg-white/10">{label}</a>
        ) : (
          <Link key={label} href={href} className="shrink-0 rounded-lg px-3 py-2 text-sm text-cyan-100 hover:bg-white/10">{label}</Link>
        ),
      )}
    </nav>
  );
}

export function SiteHeader({
  home = false,
  name,
  logo = "",
  openLabel,
  open = false,
  showGallery = false,
}: {
  home?: boolean;
  name?: string;
  logo?: string;
  openLabel?: string;
  open?: boolean;
  showGallery?: boolean;
}) {
  const live = usePoll<Live>("/api/public/live", 30000);
  const gallery = usePoll<{ id: string }[]>("/api/public/gallery", 60000);
  const business = live.data?.settings.business;
  const title = business?.name || name || "Dragon Gaming Zone";
  const mark = business?.logoDataUrl || logo;
  const known = Boolean(live.data || openLabel);
  const isOpen = live.data ? Boolean(live.data.withinHours && !live.data.closedGap) : open;
  const status = live.data ? (isOpen ? "Open now" : "Closed") : openLabel || "";
  const galleryOn = showGallery || (gallery.data?.length ?? 0) > 0;

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-900/50 bg-slate-950/95 text-cyan-50 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 md:shrink-0">
          {mark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mark} alt="" className="size-9 shrink-0 rounded-xl object-cover ring-1 ring-cyan-700/60 md:size-10" />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-400 font-heading text-lg font-bold text-slate-950 md:size-10">{title.slice(0, 1)}</span>
          )}
          <span className="truncate font-heading text-base font-bold md:text-lg">{title}</span>
        </Link>
        <NavLinks home={home} showGallery={galleryOn} className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {known && status ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold md:px-3 md:text-sm ${isOpen ? "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-400/40" : "bg-rose-400/15 text-rose-100 ring-1 ring-rose-400/40"}`}>{status}</span>
          ) : null}
          <ThemeToggle />
          <Button variant="outline" size="sm" className="shrink-0 border-cyan-700 bg-transparent px-2.5 text-cyan-50 hover:bg-white/10 hover:text-cyan-50 md:px-3" asChild>
            <Link href="/login"><span className="md:hidden">Staff</span><span className="hidden md:inline">Staff login</span></Link>
          </Button>
        </div>
      </div>
      <NavLinks home={home} showGallery={galleryOn} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:hidden" />
    </header>
  );
}
