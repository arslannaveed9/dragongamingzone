import { DateTime } from "luxon";
import type { Types } from "mongoose";
import { AppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { Tournament } from "@/models/tournament";
import { TournamentEntry } from "@/models/tournament-entry";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { getSettings } from "@/services/settings-service";

export type TournamentPhase = "upcoming" | "ongoing" | "finished" | "cancelled";
export type EntryWindow = "not_yet" | "open" | "late" | "closed" | "full";

export type TournamentAdmin = {
  id: string;
  slug: string;
  title: string;
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
  collected: number;
  profit: number;
  joinNote: string;
  published: boolean;
  cancelled: boolean;
  featured: boolean;
  hasPoster: boolean;
  phase: TournamentPhase;
  whenLabel: string;
};

export type PublicTournament = {
  id: string;
  slug: string;
  title: string;
  game: string;
  format: "solo" | "team";
  teamSize: number;
  summary: string;
  rules: string;
  startsAtIso: string;
  endsAtIso: string;
  whenLabel: string;
  checkInLabel: string;
  entryOpensLabel: string;
  entryClosesLabel: string;
  lateClosesLabel: string;
  entryFee: number;
  lateEntryFee: number;
  entryFeeLabel: string;
  lateEntryFeeLabel: string;
  phase: Exclude<TournamentPhase, "cancelled">;
  entryWindow: EntryWindow;
  entryWindowLabel: string;
  spotsLabel: string;
  prizePoolLabel: string;
  prizeFirst: string;
  prizeSecond: string;
  prizeThird: string;
  joinNote: string;
  featured: boolean;
  hasPoster: boolean;
};

type Row = {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  game: string;
  format?: string;
  teamSize?: number;
  summary?: string;
  rules?: string;
  startsAt: Date;
  endsAt: Date;
  checkInAt?: Date | null;
  entryOpensAt?: Date | null;
  entryClosesAt?: Date | null;
  entryFee?: number;
  lateEntryFee?: number;
  lateEntryClosesAt?: Date | null;
  maxEntries?: number;
  entriesTaken?: number;
  prizePool?: number;
  prizeFirst?: string;
  prizeSecond?: string;
  prizeThird?: string;
  prizeFirstAmount?: number;
  prizeSecondAmount?: number;
  prizeThirdAmount?: number;
  otherCost?: number;
  otherCostNote?: string;
  joinNote?: string;
  posterDataUrl?: string;
  published?: boolean;
  cancelled?: boolean;
  featured?: boolean;
};

type TournamentInput = {
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
  posterDataUrl?: string;
  published: boolean;
  cancelled: boolean;
  featured: boolean;
};

async function context() {
  const settings = await getSettings();
  return {
    zone: settings.operatingHours.timezone,
    symbol: settings.system.currencySymbol,
    timeFormat: settings.system.timeFormat,
    currency: settings.system.currency,
    whatsapp: settings.business.whatsapp,
    name: settings.business.name,
  };
}

function localInput(value: string, zone: string, label: string) {
  const parsed = DateTime.fromISO(value, { zone });
  if (!parsed.isValid) throw new AppError(400, "WHEN", `${label} needs a date and time.`);
  return parsed;
}

function optionalInput(value: string, zone: string, label: string) {
  if (!value.trim()) return null;
  return localInput(value, zone, label).toJSDate();
}

function toLocal(value: Date | null | undefined, zone: string) {
  if (!value) return "";
  return DateTime.fromJSDate(new Date(value)).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm");
}

function pretty(value: Date | null | undefined, zone: string, timeFormat: "12h" | "24h") {
  if (!value) return "";
  const pattern = timeFormat === "24h" ? "d LLL yyyy, HH:mm" : "d LLL yyyy, h:mm a";
  return DateTime.fromJSDate(new Date(value)).setZone(zone).toFormat(pattern);
}

function slugify(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "tournament";
}

async function uniqueSlug(raw: string, ignoreId?: string) {
  const base = slugify(raw);
  let slug = base;
  let n = 2;
  for (;;) {
    const found = await Tournament.findOne({ slug }).select("_id").lean<{ _id: unknown }>();
    if (!found || (ignoreId && String(found._id) === ignoreId)) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

function phaseOf(row: { cancelled?: boolean; startsAt: Date; endsAt: Date }, now: number): TournamentPhase {
  if (row.cancelled) return "cancelled";
  if (now < new Date(row.startsAt).getTime()) return "upcoming";
  if (now <= new Date(row.endsAt).getTime()) return "ongoing";
  return "finished";
}

function regularClose(row: Row) {
  if (row.entryClosesAt) return new Date(row.entryClosesAt).getTime();
  return new Date(row.startsAt).getTime();
}

function entryWindowOf(row: Row, now: number): EntryWindow {
  if (row.cancelled || now > new Date(row.endsAt).getTime()) return "closed";
  const max = row.maxEntries || 0;
  if (max > 0 && (row.entriesTaken || 0) >= max) return "full";
  if (row.entryOpensAt && now < new Date(row.entryOpensAt).getTime()) return "not_yet";
  const close = regularClose(row);
  if (now <= close) return "open";
  if ((row.lateEntryFee || 0) <= 0) return "closed";
  const lateClose = row.lateEntryClosesAt ? new Date(row.lateEntryClosesAt).getTime() : new Date(row.endsAt).getTime();
  if (now <= lateClose) return "late";
  return "closed";
}

function windowLabel(window: EntryWindow, row: Row, zone: string, timeFormat: "12h" | "24h") {
  if (window === "not_yet") return `Entry opens ${pretty(row.entryOpensAt, zone, timeFormat)}`;
  if (window === "open") return "Entry open";
  if (window === "late") return "Late entry";
  if (window === "full") return "Full";
  return "Entry closed";
}

function prizeLine(amount: number | undefined, note: string | undefined, symbol: string) {
  const money = (amount || 0) > 0 ? formatMoney(amount || 0, symbol) : "";
  return [money, note || ""].filter(Boolean).join(" · ");
}

function spotsLabel(row: Row) {
  const taken = row.entriesTaken || 0;
  const max = row.maxEntries || 0;
  if (max > 0) return `${taken} of ${max} ${row.format === "team" ? "teams" : "players"}`;
  if (taken > 0) return `${taken} signed up`;
  return "";
}

function apply(existing: {
  title: string;
  slug: string;
  game: string;
  format: string;
  teamSize: number;
  summary: string;
  rules: string;
  startsAt: Date;
  endsAt: Date;
  checkInAt?: Date | null;
  entryOpensAt?: Date | null;
  entryClosesAt?: Date | null;
  entryFee: number;
  lateEntryFee: number;
  lateEntryClosesAt?: Date | null;
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
}, input: TournamentInput, zone: string) {
  const starts = localInput(input.startsAt, zone, "Start");
  const ends = localInput(input.endsAt, zone, "End");
  if (ends <= starts) throw new AppError(400, "WHEN", "The end must be after the start.");
  const checkIn = optionalInput(input.checkInAt, zone, "Check-in");
  const entryOpens = optionalInput(input.entryOpensAt, zone, "Entry opens");
  const entryCloses = optionalInput(input.entryClosesAt, zone, "Entry closes");
  const lateCloses = optionalInput(input.lateEntryClosesAt, zone, "Late entry closes");
  if (checkIn && checkIn.getTime() > starts.toMillis()) throw new AppError(400, "WHEN", "Check-in must be at or before the start.");
  if (entryOpens && entryOpens.getTime() >= starts.toMillis()) throw new AppError(400, "WHEN", "Entry must open before the tournament starts.");
  if (entryOpens && entryCloses && entryCloses.getTime() <= entryOpens.getTime()) throw new AppError(400, "WHEN", "Entry must close after it opens.");
  if (entryCloses && entryCloses.getTime() > ends.toMillis()) throw new AppError(400, "WHEN", "Entry must close before the tournament ends.");
  if (lateCloses && entryCloses && lateCloses.getTime() <= entryCloses.getTime()) throw new AppError(400, "WHEN", "Late entry must close after regular entry.");
  if (lateCloses && lateCloses.getTime() > ends.toMillis()) throw new AppError(400, "WHEN", "Late entry must close before the tournament ends.");
  if (input.maxEntries > 0 && (existing.entriesTaken || 0) > input.maxEntries) throw new AppError(400, "ENTRIES", "Maximum entries is below the people already enrolled.");
  const format = input.format === "team" ? "team" : "solo";
  existing.title = input.title;
  existing.game = input.game;
  existing.format = format;
  existing.teamSize = format === "solo" ? 1 : Math.max(2, input.teamSize);
  existing.summary = input.summary;
  existing.rules = input.rules;
  existing.startsAt = starts.toJSDate();
  existing.endsAt = ends.toJSDate();
  existing.checkInAt = checkIn;
  existing.entryOpensAt = entryOpens;
  existing.entryClosesAt = entryCloses;
  existing.entryFee = input.entryFee;
  existing.lateEntryFee = input.lateEntryFee;
  existing.lateEntryClosesAt = lateCloses;
  existing.maxEntries = input.maxEntries;
  existing.prizePool = input.prizePool;
  existing.prizeFirst = input.prizeFirst;
  existing.prizeSecond = input.prizeSecond;
  existing.prizeThird = input.prizeThird;
  existing.prizeFirstAmount = input.prizeFirstAmount;
  existing.prizeSecondAmount = input.prizeSecondAmount;
  existing.prizeThirdAmount = input.prizeThirdAmount;
  existing.otherCost = input.otherCost;
  existing.otherCostNote = input.otherCostNote;
  existing.joinNote = input.joinNote;
  existing.published = input.published;
  existing.cancelled = input.cancelled;
  existing.featured = input.featured;
  if (input.posterDataUrl !== undefined) existing.posterDataUrl = input.posterDataUrl;
}

function adminItem(row: Row, zone: string, timeFormat: "12h" | "24h", now: number): TournamentAdmin {
  return {
    id: String(row._id),
    slug: row.slug,
    title: row.title,
    game: row.game,
    format: row.format === "team" ? "team" : "solo",
    teamSize: row.teamSize || 1,
    summary: row.summary || "",
    rules: row.rules || "",
    startsAt: toLocal(row.startsAt, zone),
    endsAt: toLocal(row.endsAt, zone),
    checkInAt: toLocal(row.checkInAt, zone),
    entryOpensAt: toLocal(row.entryOpensAt, zone),
    entryClosesAt: toLocal(row.entryClosesAt, zone),
    entryFee: row.entryFee || 0,
    lateEntryFee: row.lateEntryFee || 0,
    lateEntryClosesAt: toLocal(row.lateEntryClosesAt, zone),
    maxEntries: row.maxEntries || 0,
    entriesTaken: row.entriesTaken || 0,
    prizePool: row.prizePool || 0,
    prizeFirst: row.prizeFirst || "",
    prizeSecond: row.prizeSecond || "",
    prizeThird: row.prizeThird || "",
    prizeFirstAmount: row.prizeFirstAmount || 0,
    prizeSecondAmount: row.prizeSecondAmount || 0,
    prizeThirdAmount: row.prizeThirdAmount || 0,
    otherCost: row.otherCost || 0,
    otherCostNote: row.otherCostNote || "",
    collected: 0,
    profit: 0,
    joinNote: row.joinNote || "",
    published: row.published !== false,
    cancelled: Boolean(row.cancelled),
    featured: Boolean(row.featured),
    hasPoster: Boolean(row.posterDataUrl),
    phase: phaseOf(row, now),
    whenLabel: `${pretty(row.startsAt, zone, timeFormat)} – ${pretty(row.endsAt, zone, timeFormat)}`,
  };
}

function publicItem(row: Row, zone: string, symbol: string, timeFormat: "12h" | "24h", now: number): PublicTournament {
  const phase = phaseOf(row, now);
  const window = entryWindowOf(row, now);
  return {
    id: String(row._id),
    slug: row.slug,
    title: row.title,
    game: row.game,
    format: row.format === "team" ? "team" : "solo",
    teamSize: row.teamSize || 1,
    summary: row.summary || "",
    rules: row.rules || "",
    startsAtIso: new Date(row.startsAt).toISOString(),
    endsAtIso: new Date(row.endsAt).toISOString(),
    whenLabel: `${pretty(row.startsAt, zone, timeFormat)} – ${pretty(row.endsAt, zone, timeFormat)}`,
    checkInLabel: pretty(row.checkInAt, zone, timeFormat),
    entryOpensLabel: pretty(row.entryOpensAt, zone, timeFormat),
    entryClosesLabel: pretty(row.entryClosesAt, zone, timeFormat),
    lateClosesLabel: pretty(row.lateEntryClosesAt, zone, timeFormat),
    entryFee: row.entryFee || 0,
    lateEntryFee: row.lateEntryFee || 0,
    entryFeeLabel: formatMoney(row.entryFee || 0, symbol),
    lateEntryFeeLabel: (row.lateEntryFee || 0) > 0 ? formatMoney(row.lateEntryFee || 0, symbol) : "No late entry",
    phase: phase === "cancelled" ? "finished" : phase,
    entryWindow: window,
    entryWindowLabel: windowLabel(window, row, zone, timeFormat),
    spotsLabel: spotsLabel(row),
    prizePoolLabel: (row.prizePool || 0) > 0 ? formatMoney(row.prizePool || 0, symbol) : "",
    prizeFirst: prizeLine(row.prizeFirstAmount, row.prizeFirst, symbol),
    prizeSecond: prizeLine(row.prizeSecondAmount, row.prizeSecond, symbol),
    prizeThird: prizeLine(row.prizeThirdAmount, row.prizeThird, symbol),
    joinNote: row.joinNote || "",
    featured: Boolean(row.featured),
    hasPoster: Boolean(row.posterDataUrl),
  };
}

const listFields = "slug title game format teamSize summary rules startsAt endsAt checkInAt entryOpensAt entryClosesAt entryFee lateEntryFee lateEntryClosesAt maxEntries entriesTaken prizePool prizeFirst prizeSecond prizeThird prizeFirstAmount prizeSecondAmount prizeThirdAmount otherCost otherCostNote joinNote published cancelled featured";

export async function listTournaments() {
  const { zone, timeFormat, symbol } = await context();
  const rows = await Tournament.find().sort({ startsAt: 1 }).select(listFields).lean<Row[]>();
  const covered = new Set(
    (await Tournament.find({ _id: { $in: rows.map((row) => row._id) }, posterDataUrl: { $gt: "" } }).select("_id").lean<{ _id: unknown }[]>()).map((row) => String(row._id)),
  );
  const totals = await TournamentEntry.aggregate<{ _id: unknown; collected: number }>([
    { $match: { tournamentId: { $in: rows.map((row) => row._id) } } },
    { $group: { _id: "$tournamentId", collected: { $sum: "$amountPaid" } } },
  ]);
  const collectedById = new Map(totals.map((row) => [String(row._id), row.collected || 0]));
  const now = Date.now();
  return {
    currencySymbol: symbol,
    items: rows.map((row) => {
      const item = adminItem({ ...row, posterDataUrl: covered.has(String(row._id)) ? "1" : "" }, zone, timeFormat, now);
      const collected = collectedById.get(item.id) || 0;
      const prizeCost = item.prizeFirstAmount + item.prizeSecondAmount + item.prizeThirdAmount;
      return { ...item, collected, profit: collected - prizeCost - item.otherCost };
    }),
  };
}

export async function getTournament(id: string): Promise<TournamentAdmin | null> {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const { zone, timeFormat } = await context();
  const row = await Tournament.findById(id).lean<Row>();
  if (!row) return null;
  return adminItem(row, zone, timeFormat, Date.now());
}

export async function listPublicTournaments() {
  const { zone, symbol, timeFormat } = await context();
  const rows = await Tournament.find({ published: true, cancelled: { $ne: true } }).sort({ startsAt: 1 }).select(listFields).lean<Row[]>();
  const covered = new Set(
    (await Tournament.find({ _id: { $in: rows.map((row) => row._id) }, posterDataUrl: { $gt: "" } }).select("_id").lean<{ _id: unknown }[]>()).map((row) => String(row._id)),
  );
  const now = Date.now();
  const items = rows.map((row) => publicItem({ ...row, posterDataUrl: covered.has(String(row._id)) ? "1" : "" }, zone, symbol, timeFormat, now));
  const rank = { ongoing: 0, upcoming: 1, finished: 2 };
  items.sort((a, b) => rank[a.phase] - rank[b.phase] || (a.featured === b.featured ? 0 : a.featured ? -1 : 1) || a.startsAtIso.localeCompare(b.startsAtIso));
  return {
    ongoing: items.filter((item) => item.phase === "ongoing"),
    upcoming: items.filter((item) => item.phase === "upcoming"),
    finished: items.filter((item) => item.phase === "finished").slice(0, 6),
  };
}

export async function getPublishedTournament(slug: string): Promise<PublicTournament | null> {
  const { zone, symbol, timeFormat } = await context();
  const row = await Tournament.findOne({ slug, published: true, cancelled: { $ne: true } }).lean<Row>();
  if (!row) return null;
  return publicItem(row, zone, symbol, timeFormat, Date.now());
}

export async function createTournament(input: TournamentInput, actor: Actor) {
  const { zone } = await context();
  const created = new Tournament({ slug: await uniqueSlug(input.slug || input.title), posterDataUrl: "" });
  apply(created, { ...input, posterDataUrl: input.posterDataUrl || "" }, zone);
  await created.save();
  await writeAudit({
    actor,
    action: "tournament.created",
    entity: "tournament",
    entityId: String(created._id),
    newValue: { title: input.title, slug: created.slug, entryFee: input.entryFee, lateEntryFee: input.lateEntryFee, published: input.published },
  });
  const item = await getTournament(String(created._id));
  if (!item) throw new AppError(404, "NOT_FOUND", "That tournament was not found.");
  return item;
}

export async function updateTournament(id: string, input: TournamentInput, actor: Actor) {
  const existing = await Tournament.findById(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "That tournament was not found.");
  const { zone } = await context();
  existing.slug = await uniqueSlug(input.slug || input.title, id);
  apply(existing, input, zone);
  await existing.save();
  await writeAudit({
    actor,
    action: "tournament.updated",
    entity: "tournament",
    entityId: id,
    newValue: { title: input.title, slug: existing.slug, entryFee: input.entryFee, lateEntryFee: input.lateEntryFee, published: input.published, cancelled: input.cancelled },
  });
  const item = await getTournament(id);
  if (!item) throw new AppError(404, "NOT_FOUND", "That tournament was not found.");
  return item;
}

export async function removeTournament(id: string, actor: Actor) {
  const existing = await Tournament.findById(id).select("title slug");
  if (!existing) throw new AppError(404, "NOT_FOUND", "That tournament was not found.");
  await TournamentEntry.deleteMany({ tournamentId: existing._id });
  await existing.deleteOne();
  await writeAudit({ actor, action: "tournament.deleted", entity: "tournament", entityId: id, oldValue: { title: existing.title, slug: existing.slug } });
  return { ok: true };
}
