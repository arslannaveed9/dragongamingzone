"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/components/admin/client";
import { brandIconHref } from "@/lib/brand-icon";
import { emptySeo, type SeoSettings } from "@/lib/seo";

type Settings = {
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
  booking: {
    maxAdvanceDays: number;
    minDurationMinutes: number;
    maxDurationMinutes: number;
    durationStepMinutes: number;
    cancellationRequiresReason: boolean;
    allowPause: boolean;
    earlyStartMinutes: number;
  };
  system: { currency: string; currencySymbol: string; dateFormat: "dd MMM yyyy" | "yyyy-MM-dd" | "dd/MM/yyyy"; timeFormat: "12h" | "24h" };
  pricingDefaults: { per30Min: number; perHour: number; additionalPer30Min: number; additionalPerHour: number; maxControllers: number };
  seo: SeoSettings;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [owner, setOwner] = useState(false);
  const [figuresPassword, setFiguresPassword] = useState("");
  const [figuresSet, setFiguresSet] = useState(false);

  useEffect(() => {
    api<Settings>("/api/settings")
      .then((value) => setSettings({ ...value, seo: { ...emptySeo(), ...value.seo } }))
      .catch((error) => toast.error(error.message));
    api<{ user: { role: string } | null }>("/api/auth/me")
      .then((me) => setOwner(me.user?.role === "owner"))
      .catch(() => setOwner(false));
    api<{ configured: boolean }>("/api/figures")
      .then((status) => setFiguresSet(status.configured))
      .catch(() => setFiguresSet(false));
  }, []);

  async function saveFiguresPassword() {
    try {
      await api("/api/figures", { method: "PUT", body: JSON.stringify({ password: figuresPassword }) });
      setFiguresPassword("");
      setFiguresSet(true);
      toast.success("Figures password saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the figures password.");
    }
  }

  async function save() {
    if (!settings) return;
    try {
      const next = await api<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSettings(next);
      const href = brandIconHref(next.business.logoDataUrl);
      for (const rel of ["icon", "apple-touch-icon", "shortcut icon"]) {
        let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
        if (!link) {
          link = document.createElement("link");
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = href;
      }
      toast.success("Settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings.");
    }
  }

  if (!settings) return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  const business = settings.business;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <Button onClick={save}>Save</Button>
      </div>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">Business</h2>
        <Field label="Name"><Input value={business.name} onChange={(event) => setSettings({ ...settings, business: { ...business, name: event.target.value } })} /></Field>
        <Field label="Description"><Input value={business.description} onChange={(event) => setSettings({ ...settings, business: { ...business, description: event.target.value } })} /></Field>
        <Field label="Email"><Input value={business.email} onChange={(event) => setSettings({ ...settings, business: { ...business, email: event.target.value } })} /></Field>
        <Field label="Logo">
          <Input type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 400_000) {
              toast.error("Use a logo smaller than 400 KB.");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => setSettings({ ...settings, business: { ...business, logoDataUrl: String(reader.result || "") } });
            reader.readAsDataURL(file);
          }} />
        </Field>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">Public website</h2>
        <p className="text-sm text-muted-foreground">Shown on the homepage. Save after you change them.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Contact phone">
            <Input value={business.phone} placeholder="03xx xxxxxxx" onChange={(event) => setSettings({ ...settings, business: { ...business, phone: event.target.value } })} />
          </Field>
          <Field label="WhatsApp number">
            <Input value={business.whatsapp} placeholder="923001234567" onChange={(event) => setSettings({ ...settings, business: { ...business, whatsapp: event.target.value } })} />
          </Field>
          <Field label="Website opens">
            <Input type="time" value={settings.publicHours.start} onChange={(event) => setSettings({ ...settings, publicHours: { ...settings.publicHours, start: event.target.value } })} />
          </Field>
          <Field label="Website closes">
            <Input type="time" value={settings.publicHours.end} onChange={(event) => setSettings({ ...settings, publicHours: { ...settings.publicHours, end: event.target.value } })} />
          </Field>
          <Field label="Google Maps link">
            <Input value={business.mapsUrl} placeholder="https://maps.google.com/..." onChange={(event) => setSettings({ ...settings, business: { ...business, mapsUrl: event.target.value } })} />
          </Field>
          <Field label="Address">
            <Input value={business.address} onChange={(event) => setSettings({ ...settings, business: { ...business, address: event.target.value } })} />
          </Field>
          {([
            ["facebook", "Facebook link"],
            ["instagram", "Instagram link"],
            ["tiktok", "TikTok link"],
            ["youtube", "YouTube link"],
          ] as const).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input value={business.socials[key]} placeholder="https://" onChange={(event) => setSettings({ ...settings, business: { ...business, socials: { ...business.socials, [key]: event.target.value } } })} />
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The phone is a call link. WhatsApp opens a chat. Social links show as icons. The location card opens the Google Maps link. Website hours are what visitors read and do not change the gaming day used for bookings.</p>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">Operating hours</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Gaming day start"><Input type="time" value={settings.operatingHours.gamingDayStart} onChange={(event) => setSettings({ ...settings, operatingHours: { ...settings.operatingHours, gamingDayStart: event.target.value } })} /></Field>
          <Field label="Gaming day end"><Input type="time" value={settings.operatingHours.gamingDayEnd} onChange={(event) => setSettings({ ...settings, operatingHours: { ...settings.operatingHours, gamingDayEnd: event.target.value } })} /></Field>
          <Field label="Timezone"><Input value={settings.operatingHours.timezone} onChange={(event) => setSettings({ ...settings, operatingHours: { ...settings.operatingHours, timezone: event.target.value } })} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">If the end time is earlier than the start, the day runs past midnight and closes at that time the next morning.</p>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">Bookings</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Min minutes"><Input type="number" value={settings.booking.minDurationMinutes} onChange={(event) => setSettings({ ...settings, booking: { ...settings.booking, minDurationMinutes: Number(event.target.value) } })} /></Field>
          <Field label="Max minutes"><Input type="number" value={settings.booking.maxDurationMinutes} onChange={(event) => setSettings({ ...settings, booking: { ...settings.booking, maxDurationMinutes: Number(event.target.value) } })} /></Field>
          <Field label="Step minutes"><Input type="number" value={settings.booking.durationStepMinutes} onChange={(event) => setSettings({ ...settings, booking: { ...settings.booking, durationStepMinutes: Number(event.target.value) } })} /></Field>
          <Field label="Advance days"><Input type="number" value={settings.booking.maxAdvanceDays} onChange={(event) => setSettings({ ...settings, booking: { ...settings.booking, maxAdvanceDays: Number(event.target.value) } })} /></Field>
          <Field label="Early start minutes"><Input type="number" value={settings.booking.earlyStartMinutes} onChange={(event) => setSettings({ ...settings, booking: { ...settings.booking, earlyStartMinutes: Number(event.target.value) } })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.booking.allowPause} onChange={(event) => setSettings({ ...settings, booking: { ...settings.booking, allowPause: event.target.checked } })} /> Allow pause</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.booking.cancellationRequiresReason} onChange={(event) => setSettings({ ...settings, booking: { ...settings.booking, cancellationRequiresReason: event.target.checked } })} /> Cancellation requires a reason</label>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">System and default rates</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Currency code"><Input value={settings.system.currency} onChange={(event) => setSettings({ ...settings, system: { ...settings.system, currency: event.target.value } })} /></Field>
          <Field label="Symbol"><Input value={settings.system.currencySymbol} onChange={(event) => setSettings({ ...settings, system: { ...settings.system, currencySymbol: event.target.value } })} /></Field>
          <Field label="Time format">
            <select className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" value={settings.system.timeFormat} onChange={(event) => setSettings({ ...settings, system: { ...settings.system, timeFormat: event.target.value as "12h" | "24h" } })}>
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </Field>
          <Field label="Default 30 min"><Input type="number" value={settings.pricingDefaults.per30Min} onChange={(event) => setSettings({ ...settings, pricingDefaults: { ...settings.pricingDefaults, per30Min: Number(event.target.value) } })} /></Field>
          <Field label="Default hour"><Input type="number" value={settings.pricingDefaults.perHour} onChange={(event) => setSettings({ ...settings, pricingDefaults: { ...settings.pricingDefaults, perHour: Number(event.target.value) } })} /></Field>
        </div>
      </section>
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">Search engines</h2>
        <p className="text-sm text-muted-foreground">These titles and descriptions are what Google and shared links use. Leave a page title blank to use the site title.</p>
        <Field label="Public site URL">
          <Input value={settings.seo.siteUrl} placeholder="https://your-domain.com" onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, siteUrl: event.target.value } })} />
        </Field>
        <p className="text-sm text-muted-foreground">The full address of this website, with https. It builds the sitemap and the canonical link on each page.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Site title">
            <Input value={settings.seo.title} maxLength={70} placeholder={business.name} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, title: event.target.value } })} />
          </Field>
          <Field label="Keywords">
            <Input value={settings.seo.keywords} placeholder="gaming zone, ps5, karachi" onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, keywords: event.target.value } })} />
          </Field>
        </div>
        <Field label="Site description">
          <Input value={settings.seo.description} maxLength={300} placeholder={business.description} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, description: event.target.value } })} />
        </Field>
        <Field label="Google Search Console code">
          <Input value={settings.seo.googleVerification} placeholder="Paste the verification content value" onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, googleVerification: event.target.value } })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.seo.index} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, index: event.target.checked } })} />
          Let search engines index the public site
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Home title"><Input value={settings.seo.homeTitle} maxLength={70} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, homeTitle: event.target.value } })} /></Field>
          <Field label="Home description"><Input value={settings.seo.homeDescription} maxLength={300} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, homeDescription: event.target.value } })} /></Field>
          <Field label="Blog title"><Input value={settings.seo.blogTitle} maxLength={70} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, blogTitle: event.target.value } })} /></Field>
          <Field label="Blog description"><Input value={settings.seo.blogDescription} maxLength={300} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, blogDescription: event.target.value } })} /></Field>
          <Field label="Notices title"><Input value={settings.seo.noticesTitle} maxLength={70} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, noticesTitle: event.target.value } })} /></Field>
          <Field label="Notices description"><Input value={settings.seo.noticesDescription} maxLength={300} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, noticesDescription: event.target.value } })} /></Field>
          <Field label="Tournaments title"><Input value={settings.seo.tournamentsTitle} maxLength={70} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, tournamentsTitle: event.target.value } })} /></Field>
          <Field label="Tournaments description"><Input value={settings.seo.tournamentsDescription} maxLength={300} onChange={(event) => setSettings({ ...settings, seo: { ...settings.seo, tournamentsDescription: event.target.value } })} /></Field>
        </div>
        <Field label="Share image">
          <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !settings) return;
            if (file.size > 400_000) {
              toast.error("Use a share image smaller than 400 KB.");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => setSettings({ ...settings, seo: { ...settings.seo, ogImageDataUrl: String(reader.result || "") } });
            reader.readAsDataURL(file);
          }} />
        </Field>
        {settings.seo.ogImageDataUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.seo.ogImageDataUrl} alt="" className="aspect-[1.91/1] w-full max-w-sm rounded-lg object-cover" />
            <Button type="button" variant="outline" onClick={() => setSettings({ ...settings, seo: { ...settings.seo, ogImageDataUrl: "" } })}>Remove share image</Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">Used when a page is shared. If you leave this empty, the logo is used.</p>}
      </section>
      {owner && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Financial figures</h2>
          <p className="text-sm text-muted-foreground">
            {figuresSet ? "A password is set. Anyone with it can reveal revenue and unpaid amounts from the eye on the dashboard." : "Set a password so the eye on the dashboard can reveal revenue and unpaid amounts."}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={figuresSet ? "New password" : "Password"}>
              <Input type="password" value={figuresPassword} onChange={(event) => setFiguresPassword(event.target.value)} autoComplete="new-password" />
            </Field>
            <Button type="button" variant="outline" disabled={figuresPassword.length < 4} onClick={() => void saveFiguresPassword()}>Save password</Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm"><Label>{label}</Label>{children}</label>;
}
