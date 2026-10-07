"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TournamentLedgerPanel } from "@/components/admin/tournament-ledger";
import { api, notifyRefresh, usePoll } from "@/components/admin/client";
import { formatMoney } from "@/lib/money";
import type { TournamentAdmin, TournamentPhase } from "@/services/tournament-service";

type Board = { currencySymbol: string; items: TournamentAdmin[] };

type Draft = {
  id: string | null;
  title: string;
  slug: string;
  game: string;
  format: "solo" | "team";
  teamSize: number;
  summary: string;
  rules: string;
  startsAt: string;
  endsAt: string;
  checkInAt: string;
  entryOpensAt: string;
  entryClosesAt: string;
  entryFee: number;
  lateEntryFee: number;
  lateEntryClosesAt: string;
  maxEntries: number;
  entriesTaken: number;
  prizePool: number;
  prizeFirst: string;
  prizeSecond: string;
  prizeThird: string;
  prizeFirstAmount: number;
  prizeSecondAmount: number;
  prizeThirdAmount: number;
  otherCost: number;
  otherCostNote: string;
  joinNote: string;
  published: boolean;
  cancelled: boolean;
  featured: boolean;
  posterDataUrl?: string;
  hasPoster: boolean;
};

const empty: Draft = {
  id: null,
  title: "",
  slug: "",
  game: "",
  format: "solo",
  teamSize: 1,
  summary: "",
  rules: "",
  startsAt: "",
  endsAt: "",
  checkInAt: "",
  entryOpensAt: "",
  entryClosesAt: "",
  entryFee: 0,
  lateEntryFee: 0,
  lateEntryClosesAt: "",
  maxEntries: 0,
  entriesTaken: 0,
  prizePool: 0,
  prizeFirst: "",
  prizeSecond: "",
  prizeThird: "",
  prizeFirstAmount: 0,
  prizeSecondAmount: 0,
  prizeThirdAmount: 0,
  otherCost: 0,
  otherCostNote: "",
  joinNote: "Pay the entry fee at the counter.",
  published: true,
  cancelled: false,
  featured: false,
  hasPoster: false,
};

const phaseLabel: Record<TournamentPhase, string> = {
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  finished: "Finished",
  cancelled: "Cancelled",
};

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function preparePoster(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP photo.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Could not read that photo.");
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that photo.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  if (dataUrl.length > 1_400_000) throw new Error("That photo is still too large. Try a smaller one.");
  return dataUrl;
}

export default function TournamentsAdminPage() {
  const { data, reload } = usePoll<Board>("/api/tournaments");
  const [draft, setDraft] = useState<Draft>(empty);
  const [slugEdited, setSlugEdited] = useState(false);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const symbol = data?.currencySymbol || "Rs";

  function startNew() {
    setDraft(empty);
    setSlugEdited(false);
    setPreview("");
  }

  async function edit(item: TournamentAdmin) {
    const full = await api<TournamentAdmin>(`/api/tournaments/${item.id}`);
    setDraft({ ...full, id: full.id, posterDataUrl: undefined });
    setSlugEdited(true);
    setPreview("");
  }

  async function save() {
    if (!draft.title.trim() || !draft.game.trim() || !draft.startsAt || !draft.endsAt) {
      toast.error("Add a title, game, start, and end.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: draft.title.trim(),
        slug: draft.slug.trim(),
        game: draft.game.trim(),
        format: draft.format,
        teamSize: draft.format === "team" ? draft.teamSize : 1,
        summary: draft.summary.trim(),
        rules: draft.rules.trim(),
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        checkInAt: draft.checkInAt,
        entryOpensAt: draft.entryOpensAt,
        entryClosesAt: draft.entryClosesAt,
        entryFee: draft.entryFee,
        lateEntryFee: draft.lateEntryFee,
        lateEntryClosesAt: draft.lateEntryClosesAt,
        maxEntries: draft.maxEntries,
        prizePool: draft.prizePool,
        prizeFirst: draft.prizeFirst.trim(),
        prizeSecond: draft.prizeSecond.trim(),
        prizeThird: draft.prizeThird.trim(),
        prizeFirstAmount: draft.prizeFirstAmount,
        prizeSecondAmount: draft.prizeSecondAmount,
        prizeThirdAmount: draft.prizeThirdAmount,
        otherCost: draft.otherCost,
        otherCostNote: draft.otherCostNote.trim(),
        joinNote: draft.joinNote.trim(),
        published: draft.published,
        cancelled: draft.cancelled,
        featured: draft.featured,
        ...(draft.posterDataUrl !== undefined ? { posterDataUrl: draft.posterDataUrl } : {}),
      };
      if (draft.id) {
        await api(`/api/tournaments/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Tournament updated.");
      } else {
        await api("/api/tournaments", { method: "POST", body: JSON.stringify(payload) });
        toast.success(draft.published ? "Tournament is on the site." : "Draft saved.");
        startNew();
      }
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the tournament.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: TournamentAdmin) {
    try {
      await api(`/api/tournaments/${item.id}`, { method: "DELETE" });
      if (draft.id === item.id) startNew();
      if (manageId === item.id) setManageId(null);
      toast.success("Tournament deleted.");
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the tournament.");
    }
  }

  const posterSrc = preview || (draft.id && draft.hasPoster && draft.posterDataUrl !== "" ? `/api/tournaments/${draft.id}/poster` : "");

  return (
    <div className="space-y-5">
      <div>
        <p className="gz-kicker text-cyan-800 dark:text-cyan-200">Website</p>
        <h1 className="gz-title">Tournaments</h1>
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">Published events show on the public tournaments page as ongoing or upcoming from their start and end times. Set the entry fee, the late entry fee, and when each window closes.</p>
      </div>

      <section className="gz-panel space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">{draft.id ? "Edit tournament" : "New tournament"}</h2>
          {draft.id ? <Button type="button" variant="outline" size="sm" onClick={startNew}>New tournament</Button> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tn-title">Title</Label>
            <Input id="tn-title" value={draft.title} placeholder="Friday FC night" onChange={(event) => setDraft({ ...draft, title: event.target.value, slug: slugEdited ? draft.slug : slugify(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-game">Game</Label>
            <Input id="tn-game" value={draft.game} placeholder="FC 26" onChange={(event) => setDraft({ ...draft, game: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-slug">Link</Label>
            <Input id="tn-slug" value={draft.slug} placeholder="friday-fc-night" onChange={(event) => { setSlugEdited(true); setDraft({ ...draft, slug: event.target.value }); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Format</Label>
            <div className="flex gap-2">
              <Button type="button" variant={draft.format === "solo" ? "default" : "outline"} onClick={() => setDraft({ ...draft, format: "solo", teamSize: 1 })}>Solo</Button>
              <Button type="button" variant={draft.format === "team" ? "default" : "outline"} onClick={() => setDraft({ ...draft, format: "team", teamSize: Math.max(2, draft.teamSize) })}>Team</Button>
            </div>
          </div>
          {draft.format === "team" ? (
            <div className="space-y-1.5">
              <Label htmlFor="tn-size">Players per team</Label>
              <Input id="tn-size" type="number" min={2} max={20} value={draft.teamSize} onChange={(event) => setDraft({ ...draft, teamSize: Number(event.target.value) })} />
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tn-summary">Short summary</Label>
          <Input id="tn-summary" value={draft.summary} placeholder="One line for the tournaments list" onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tn-start">Starts</Label>
            <Input id="tn-start" type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-end">Ends</Label>
            <Input id="tn-end" type="datetime-local" value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-check">Check-in</Label>
            <Input id="tn-check" type="datetime-local" value={draft.checkInAt} onChange={(event) => setDraft({ ...draft, checkInAt: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-open">Entry opens</Label>
            <Input id="tn-open" type="datetime-local" value={draft.entryOpensAt} onChange={(event) => setDraft({ ...draft, entryOpensAt: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-close">Entry closes</Label>
            <Input id="tn-close" type="datetime-local" value={draft.entryClosesAt} onChange={(event) => setDraft({ ...draft, entryClosesAt: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-late-close">Late entry closes</Label>
            <Input id="tn-late-close" type="datetime-local" value={draft.lateEntryClosesAt} onChange={(event) => setDraft({ ...draft, lateEntryClosesAt: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-fee">Entry fee ({symbol})</Label>
            <Input id="tn-fee" type="number" min={0} value={draft.entryFee} onChange={(event) => setDraft({ ...draft, entryFee: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-late">Late entry fee ({symbol})</Label>
            <Input id="tn-late" type="number" min={0} value={draft.lateEntryFee} onChange={(event) => setDraft({ ...draft, lateEntryFee: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-max">Maximum entries</Label>
            <Input id="tn-max" type="number" min={0} value={draft.maxEntries} onChange={(event) => setDraft({ ...draft, maxEntries: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-pool">Prize pool ({symbol})</Label>
            <Input id="tn-pool" type="number" min={0} value={draft.prizePool} onChange={(event) => setDraft({ ...draft, prizePool: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-first-amount">1st prize ({symbol})</Label>
            <Input id="tn-first-amount" type="number" min={0} value={draft.prizeFirstAmount} onChange={(event) => setDraft({ ...draft, prizeFirstAmount: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-second-amount">2nd prize ({symbol})</Label>
            <Input id="tn-second-amount" type="number" min={0} value={draft.prizeSecondAmount} onChange={(event) => setDraft({ ...draft, prizeSecondAmount: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-third-amount">3rd prize ({symbol})</Label>
            <Input id="tn-third-amount" type="number" min={0} value={draft.prizeThirdAmount} onChange={(event) => setDraft({ ...draft, prizeThirdAmount: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-other">Other costs ({symbol})</Label>
            <Input id="tn-other" type="number" min={0} value={draft.otherCost} onChange={(event) => setDraft({ ...draft, otherCost: Number(event.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-other-note">Other cost note</Label>
            <Input id="tn-other-note" value={draft.otherCostNote} placeholder="Snacks, extra station time" onChange={(event) => setDraft({ ...draft, otherCostNote: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-first">1st prize note</Label>
            <Input id="tn-first" value={draft.prizeFirst} placeholder="Shown beside the amount" onChange={(event) => setDraft({ ...draft, prizeFirst: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-second">2nd prize note</Label>
            <Input id="tn-second" value={draft.prizeSecond} onChange={(event) => setDraft({ ...draft, prizeSecond: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tn-third">3rd prize note</Label>
            <Input id="tn-third" value={draft.prizeThird} onChange={(event) => setDraft({ ...draft, prizeThird: event.target.value })} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Leave maximum entries at 0 for no cap. Signed-up count comes from the people you enroll. Prize amounts are what you pay out. Profit is collected fees minus those prizes and other costs. Times use the gaming-zone timezone.</p>
        <div className="space-y-1.5">
          <Label htmlFor="tn-join">How to enter</Label>
          <Input id="tn-join" value={draft.joinNote} onChange={(event) => setDraft({ ...draft, joinNote: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tn-rules">Rules</Label>
          <Textarea id="tn-rules" value={draft.rules} className="min-h-36" placeholder="Format, stations, and house rules." onChange={(event) => setDraft({ ...draft, rules: event.target.value })} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
            <ImagePlus className="size-4" />
            Poster
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void preparePoster(file).then((dataUrl) => {
                  setDraft({ ...draft, posterDataUrl: dataUrl, hasPoster: true });
                  setPreview(dataUrl);
                }).catch((error: unknown) => {
                  toast.error(error instanceof Error ? error.message : "Could not read that photo.");
                });
              }}
            />
          </label>
          {posterSrc ? <Button type="button" variant="outline" size="sm" onClick={() => { setDraft({ ...draft, posterDataUrl: "", hasPoster: false }); setPreview(""); }}>Remove poster</Button> : null}
          <Button type="button" variant={draft.published ? "default" : "outline"} onClick={() => setDraft({ ...draft, published: !draft.published })}>{draft.published ? "Published" : "Hidden"}</Button>
          <Button type="button" variant={draft.featured ? "default" : "outline"} onClick={() => setDraft({ ...draft, featured: !draft.featured })}>{draft.featured ? "Featured" : "Feature"}</Button>
          <Button type="button" variant={draft.cancelled ? "default" : "outline"} onClick={() => setDraft({ ...draft, cancelled: !draft.cancelled })}>{draft.cancelled ? "Cancelled" : "Cancel event"}</Button>
        </div>
        {posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterSrc} alt="" className="aspect-[16/7] w-full max-w-xl rounded-xl object-cover" />
        ) : null}
        <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : draft.id ? "Save tournament" : "Save tournament"}</Button>
      </section>

      {manageId ? (
        <TournamentLedgerPanel
          tournamentId={manageId}
          onClose={() => setManageId(null)}
          onChanged={(next) => {
            void reload();
            setDraft((current) => current.id === manageId ? {
              ...current,
              prizeFirstAmount: next.prizeFirstAmount,
              prizeSecondAmount: next.prizeSecondAmount,
              prizeThirdAmount: next.prizeThirdAmount,
              otherCost: next.otherCost,
              otherCostNote: next.otherCostNote,
              entriesTaken: next.books.count,
            } : current);
          }}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Tournaments</h2>
        {(data?.items || []).map((item) => (
          <article key={item.id} className="gz-panel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{item.title} <span className="font-normal text-muted-foreground">{phaseLabel[item.phase]}{item.published ? "" : " · hidden"}</span></p>
              <p className="text-sm text-muted-foreground">{item.game} · {item.whenLabel}</p>
              <p className="text-sm text-muted-foreground">Entry {symbol} {item.entryFee} · Late {item.lateEntryFee > 0 ? `${symbol} ${item.lateEntryFee}` : "none"} · {item.entriesTaken} enrolled</p>
              <p className="text-sm text-muted-foreground">Collected {formatMoney(item.collected, symbol)} · Profit {formatMoney(item.profit, symbol)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={manageId === item.id ? "default" : "outline"} size="sm" onClick={() => setManageId(item.id)}>Entries</Button>
              {item.published && !item.cancelled ? <Button type="button" variant="outline" size="sm" asChild><a href={`/tournaments/${item.slug}`} target="_blank" rel="noreferrer">View</a></Button> : null}
              <Button type="button" variant="outline" size="sm" onClick={() => void edit(item)}>Edit</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void remove(item)}>Delete</Button>
            </div>
          </article>
        ))}
        {data?.items.length === 0 ? <p className="text-sm text-muted-foreground">No tournaments yet.</p> : null}
      </section>
    </div>
  );
}
