"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { formatClock, positionOnPublicTimeline, publicHoursTicks } from "@/lib/gaming-day";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Countdown } from "@/components/admin/countdown";
import { DayTimeline } from "@/components/day-timeline";
import { formatHm, money, usePoll } from "@/components/admin/client";
import { StatusPill } from "@/components/admin/status-pill";
import { SiteHeader } from "@/components/public/site-header";

type Board = {
  serverNow: string;
  gamingDay: string;
  withinHours: boolean;
  closedGap: boolean;
  dayStart: string;
  dayEnd: string;
  settings: {
    business: {
      name: string;
      description: string;
      logoDataUrl: string;
      address: string;
      phone: string;
      whatsapp: string;
      email: string;
      mapsUrl: string;
      socials: { facebook: string; instagram: string; tiktok: string; youtube: string };
    };
    operatingHours: { gamingDayStart: string; gamingDayEnd: string; timezone: string };
    publicHours: { start: string; end: string };
    system: { currencySymbol: string; timeFormat: "12h" | "24h" };
  };
  stations: {
    id: string;
    name: string;
    typeName: string;
    status: string;
    pricing: { per30Min: number; perHour: number; additionalPerHour: number; current30: number; current60: number; discount30: string | null };
    current: null | { customerName: string; controllerCount: number; startAt: string; endAt: string; paused: boolean; remainingMs: number };
    next: null | { startAt: string; endAt: string };
    nextAvailableAt: string | null;
    timeline: { bookingId: string; status: string; startAt: string; endAt: string; customerName: string }[];
  }[];
  discounts: { id: string; name: string; type: string; value: number; startTime: string | null; endTime: string | null; daysOfWeek: number[] }[];
  activeDiscounts: { id: string; name: string }[];
};

type GalleryPhoto = { id: string; caption: string };

export function HomeView({ initial, initialGallery = [] }: { initial: Board | null; initialGallery?: GalleryPhoto[] }) {
  const [day, setDay] = useState("");
  const polled = usePoll<Board>(`/api/public/live${day ? `?gamingDay=${day}` : ""}`, 15000);
  const data = polled.data || (!day ? initial : null);
  const notices = usePoll<{ id: string; title: string; body: string; postedAt: string }[]>("/api/public/notices", 20000);
  const gallery = usePoll<GalleryPhoto[]>("/api/public/gallery", 60000);
  const photos = gallery.data ?? initialGallery;
  const [photoOpen, setPhotoOpen] = useState<GalleryPhoto | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const notice = notices.data?.[0];
  const noticeRef = useRef(notice);
  const opened = useRef(false);
  const started = useRef(Date.now());
  noticeRef.current = notice;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (noticeRef.current && !opened.current) {
        opened.current = true;
        setNoticeOpen(true);
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice || opened.current) return;
    const remaining = Math.max(0, 5000 - (Date.now() - started.current));
    const timer = window.setTimeout(() => {
      if (!opened.current && noticeRef.current) {
        opened.current = true;
        setNoticeOpen(true);
      }
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!data) return <main className="grid min-h-screen place-items-center bg-slate-950 text-cyan-100">Loading the floor...</main>;

  const { settings } = data;
  const business = settings.business;
  const hours = settings.operatingHours;
  const symbol = settings.system.currencySymbol;
  const ticks = publicHoursTicks(hours);
  const clock = (iso: string) => formatClock(new Date(iso), hours.timezone, settings.system.timeFormat);
  const shownHours = settings.publicHours || { start: hours.gamingDayStart, end: hours.gamingDayEnd };
  const hoursLabel = `${formatHm(shownHours.start, settings.system.timeFormat)} – ${formatHm(shownHours.end, settings.system.timeFormat)}`;
  const openNow = data.withinHours && !data.closedGap;
  const openLabel = data.closedGap ? "Closed" : data.withinHours ? "Open now" : "Closed";
  const playing = data.stations.filter((station) => station.status === "playing" || station.status === "paused").length;
  const free = data.stations.filter((station) => station.status === "available").length;
  const reserved = data.stations.filter((station) => station.status === "reserved").length;
  const socials = (
    [
      ["Facebook", business.socials.facebook, <FacebookIcon key="facebook" />],
      ["Instagram", business.socials.instagram, <InstagramIcon key="instagram" />],
      ["TikTok", business.socials.tiktok, <TikTokIcon key="tiktok" />],
      ["YouTube", business.socials.youtube, <YouTubeIcon key="youtube" />],
    ] as const
  ).filter((entry) => entry[1]);
  const nowOnChart = !day || day === data.gamingDay ? positionOnPublicTimeline(new Date(data.serverNow), data.gamingDay, hours) : null;
  const nowRatio = nowOnChart != null && nowOnChart >= 0 && nowOnChart <= 1 ? nowOnChart : null;
  const whatsapp = business.whatsapp.replace(/\D/g, "");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader home name={business.name} logo={business.logoDataUrl} openLabel={openLabel} open={openNow} showGallery={photos.length > 0} />

      <Dialog open={noticeOpen && Boolean(notice)} onOpenChange={setNoticeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{notice?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{notice?.postedAt}</p>
          <p className="whitespace-pre-wrap text-base">{notice?.body}</p>
          <DialogFooter>
            <Button type="button" onClick={() => setNoticeOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="relative overflow-hidden bg-slate-950 text-cyan-50">
        <div className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 size-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:py-16 md:grid-cols-[1.4fr_0.8fr] md:py-24">
          <div>
            <p className="gz-kicker text-cyan-300">{openNow ? "The floor is open" : "The floor is closed"}</p>
            <h1 className="mt-3 max-w-3xl font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl">{business.name}</h1>
            <p className="mt-5 max-w-xl text-lg text-cyan-100/80">
              {business.description || "Consoles and PCs, live availability, and today's rates in one place."}
            </p>
            <p className="mt-6 text-base text-cyan-100">Open {hoursLabel}{business.address ? ` · ${business.address}` : ""}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300 sm:w-auto" asChild>
                <a href="#floor">See what's free</a>
              </Button>
              {business.phone ? (
                <Button variant="outline" className="w-full border-cyan-700 bg-transparent text-cyan-50 hover:bg-white/10 hover:text-cyan-50 sm:w-auto" asChild>
                  <a href={`tel:${business.phone}`}>Call {business.phone}</a>
                </Button>
              ) : null}
              {whatsapp ? (
                <Button variant="outline" className="w-full border-cyan-700 bg-transparent text-cyan-50 hover:bg-white/10 hover:text-cyan-50 sm:w-auto" asChild>
                  <a href={`https://wa.me/${whatsapp}`}>WhatsApp</a>
                </Button>
              ) : null}
              {!business.phone && !whatsapp ? (
                <Button variant="outline" className="w-full border-cyan-700 bg-transparent text-cyan-50 hover:bg-white/10 hover:text-cyan-50 sm:w-auto" asChild>
                  <a href="#visit">Plan a visit</a>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-end">
            <Stat label="Free now" value={String(free)} />
            <Stat label="In session" value={String(playing)} />
            <Stat label="Reserved" value={String(reserved)} />
            <Stat label="Stations" value={String(data.stations.length)} />
          </div>
        </div>
      </section>

      {photos.length > 0 ? (
        <section id="gallery" className="scroll-mt-28 border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
            <p className="gz-kicker text-cyan-800 dark:text-cyan-300">Gallery</p>
            <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Inside {business.name}</h2>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setPhotoOpen(photo)}
                  className="overflow-hidden rounded-2xl border border-border bg-card text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/public/gallery/${photo.id}`} alt={photo.caption || business.name} className="aspect-[4/3] w-full object-cover" />
                  {photo.caption ? <span className="block px-3 py-2 text-sm text-muted-foreground">{photo.caption}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Dialog open={Boolean(photoOpen)} onOpenChange={(open) => { if (!open) setPhotoOpen(null); }}>
        <DialogContent className="sm:max-w-3xl">
          {photoOpen ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/public/gallery/${photoOpen.id}`} alt={photoOpen.caption || business.name} className="max-h-[70dvh] w-full rounded-lg object-contain" />
              {photoOpen.caption ? <p className="text-base">{photoOpen.caption}</p> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <section id="floor" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-10 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="gz-kicker text-cyan-800 dark:text-cyan-300">Live floor</p>
            <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">What's on right now</h2>
          </div>
          <p className="text-sm text-muted-foreground">Updates on their own. A free station can be started at the counter.</p>
        </div>
        {data.stations.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">Stations will show here once the floor is set up.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.stations.map((station) => (
            <article key={station.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{station.typeName}</p>
                  <h3 className="font-heading text-2xl font-bold">{station.name}</h3>
                </div>
                <StatusPill status={station.status} />
              </div>
              {station.current ? (
                <div className="mt-5 space-y-3">
                  <Countdown endAt={station.current.endAt} paused={station.current.paused} remainingMs={station.current.remainingMs} serverNow={data.serverNow} />
                  <p className="text-sm text-muted-foreground">
                    {clock(station.current.startAt)} – {clock(station.current.endAt)}
                    {station.nextAvailableAt ? ` · free after ${clock(station.nextAvailableAt)}` : ""}
                  </p>
                </div>
              ) : (
                <div className="mt-5">
                  <p className="font-heading text-2xl font-bold tabular-nums sm:text-3xl">{money(station.pricing.current60, symbol)}<span className="ml-1 text-base font-medium text-muted-foreground">/ hour</span></p>
                  <p className="mt-1 text-sm text-muted-foreground">{money(station.pricing.current30, symbol)} / 30 min{station.pricing.additionalPerHour ? ` · extra controller ${money(station.pricing.additionalPerHour, symbol)} / hour` : ""}</p>
                  {station.pricing.discount30 ? <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">{station.pricing.discount30} is on this rate</p> : null}
                </div>
              )}
              {station.next && <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">Next booking {clock(station.next.startAt)} – {clock(station.next.endAt)}</p>}
            </article>
          ))}
        </div>
      </section>

      <section id="schedule" className="scroll-mt-28 border-y border-border bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <p className="gz-kicker text-cyan-800 dark:text-cyan-300">Schedule</p>
              <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Today on the floor</h2>
              <p className="mt-2 max-w-xl text-muted-foreground">Each row is one station, from opening until midnight. Swipe the chart sideways. The red line is the current time.</p>
            </div>
            <label className="w-full text-sm text-muted-foreground sm:w-auto">
              Gaming day
              <Input type="date" className="mt-1 w-full sm:w-44" value={day || data.gamingDay} onChange={(event) => setDay(event.target.value)} />
            </label>
          </div>
          <DayTimeline
            ticks={ticks}
            timeFormat={settings.system.timeFormat}
            nowRatio={nowRatio}
            nowLabel={formatClock(new Date(data.serverNow), hours.timezone, settings.system.timeFormat)}
            rows={data.stations.map((station) => ({
              id: station.id,
              name: station.name,
              blocks: station.timeline.flatMap((block) => {
                const start = positionOnPublicTimeline(new Date(block.startAt), data.gamingDay, hours);
                const end = positionOnPublicTimeline(new Date(block.endAt), data.gamingDay, hours);
                if (end <= 0 || start >= 1) return [];
                return [{
                  id: block.bookingId,
                  status: block.status,
                  start: Math.max(0, start),
                  end: Math.min(1, end),
                }];
              }),
            }))}
          />
        </div>
      </section>

      <section id="visit" className="scroll-mt-28 bg-slate-950 text-cyan-50">
        <div className={`mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:py-16 ${business.mapsUrl || business.address ? "lg:grid-cols-[1.1fr_0.9fr]" : ""}`}>
          <div>
            <p className="gz-kicker text-cyan-300">Visit</p>
            <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Come play</h2>
            <dl className="mt-6 space-y-4 text-base">
              <div>
                <dt className="text-sm text-cyan-200/70">Hours</dt>
                <dd>{hoursLabel}</dd>
              </div>
              {business.phone && (
                <div>
                  <dt className="text-sm text-cyan-200/70">Phone</dt>
                  <dd><a className="underline-offset-2 hover:underline" href={`tel:${business.phone}`}>{business.phone}</a></dd>
                </div>
              )}
              {whatsapp && (
                <div>
                  <dt className="text-sm text-cyan-200/70">WhatsApp</dt>
                  <dd><a className="underline-offset-2 hover:underline" href={`https://wa.me/${whatsapp}`}>{business.whatsapp}</a></dd>
                </div>
              )}
              {business.email && (
                <div>
                  <dt className="text-sm text-cyan-200/70">Email</dt>
                  <dd><a className="underline-offset-2 hover:underline" href={`mailto:${business.email}`}>{business.email}</a></dd>
                </div>
              )}
            </dl>
          </div>
          <div className="flex flex-col items-start gap-8 lg:items-end">
            {business.mapsUrl ? (
              <a
                href={externalHref(business.mapsUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-56 w-full flex-col justify-between rounded-2xl bg-white/5 p-6 ring-1 ring-cyan-800/60 transition hover:bg-white/10"
              >
                <span className="grid size-12 place-items-center rounded-full bg-cyan-400 text-slate-950">
                  <MapPin className="size-6" />
                </span>
                <span>
                  <span className="block font-heading text-3xl font-bold">Location</span>
                  <span className="mt-2 block text-cyan-100/80">{business.address || "Open in Google Maps"}</span>
                  <span className="mt-4 inline-block text-sm font-semibold text-cyan-300">Open in Google Maps</span>
                </span>
              </a>
            ) : business.address ? (
              <div className="flex min-h-56 w-full flex-col justify-end rounded-2xl bg-white/5 p-6 ring-1 ring-cyan-800/60">
                <p className="font-heading text-3xl font-bold">Location</p>
                <p className="mt-2 text-cyan-100/80">{business.address}</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="border-t border-cyan-900/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="font-heading text-base font-semibold text-cyan-50">{business.name}</p>
            <div className="flex flex-wrap items-center gap-4 sm:ml-auto sm:justify-end">
              <p className="text-sm text-cyan-100/70">Open {hoursLabel}</p>
              {socials.length > 0 ? (
                <div className="flex flex-wrap justify-end gap-3">
                  {socials.map(([label, href, icon]) => (
                    <a
                      key={label}
                      href={externalHref(href)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      title={label}
                      className="grid size-11 place-items-center rounded-full bg-white/10 text-cyan-50 ring-1 ring-cyan-700 transition hover:bg-cyan-400 hover:text-slate-950"
                    >
                      {icon}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function externalHref(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="currentColor" d="M14.5 8.5V6.8c0-.7.5-1 1.2-1H17V3h-2.2C12.2 3 11 4.4 11 6.6v1.9H9v2.7h2V21h3v-9.8h2.3l.4-2.7h-2.7z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="currentColor" d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5zm8 2H8a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3zm-4 3.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 2A1.8 1.8 0 1 0 13.8 12 1.8 1.8 0 0 0 12 10.2zM17.2 6.6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="currentColor" d="M14 3h2.2a5.4 5.4 0 0 0 3.6 3.4v2.3a7.6 7.6 0 0 1-3.6-1v6.6a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v2.4a3.3 3.3 0 1 0 2.3 3.2V3z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="currentColor" d="M22 12.2s0-3.2-.4-4.6a3 3 0 0 0-2.1-2.1C17.9 5 12 5 12 5s-5.9 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12.2 2 12.2s0 3.2.4 4.6a3 3 0 0 0 2.1 2.1C6.1 19.4 12 19.4 12 19.4s5.9 0 7.5-.5a3 3 0 0 0 2.1-2.1c.4-1.4.4-4.6.4-4.6zM10 15.5v-6.6l5.2 3.3z" />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-5 ring-1 ring-cyan-800/50">
      <p className="font-heading text-3xl font-bold tabular-nums sm:text-4xl">{value}</p>
      <p className="mt-1 text-sm text-cyan-100/70">{label}</p>
    </div>
  );
}
