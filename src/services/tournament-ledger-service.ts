import { AppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { Tournament } from "@/models/tournament";
import { TournamentEntry } from "@/models/tournament-entry";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { getSettings } from "@/services/settings-service";

export type LedgerEntry = {
  id: string;
  name: string;
  phone: string;
  teamName: string;
  kind: "regular" | "late";
  feeDue: number;
  amountPaid: number;
  outstanding: number;
  place: 0 | 1 | 2 | 3;
  note: string;
};

export type TournamentLedger = {
  currencySymbol: string;
  title: string;
  format: "solo" | "team";
  entryFee: number;
  lateEntryFee: number;
  maxEntries: number;
  prizeFirstAmount: number;
  prizeSecondAmount: number;
  prizeThirdAmount: number;
  otherCost: number;
  otherCostNote: string;
  entries: LedgerEntry[];
  books: {
    count: number;
    collected: number;
    due: number;
    outstanding: number;
    prizeCost: number;
    otherCost: number;
    profit: number;
    expected: number;
    collectedLabel: string;
    outstandingLabel: string;
    prizeCostLabel: string;
    otherCostLabel: string;
    profitLabel: string;
    expectedLabel: string;
  };
};

type EntryInput = {
  name: string;
  phone: string;
  teamName: string;
  kind: "regular" | "late";
  feeDue: number;
  amountPaid: number;
  place: number;
  note: string;
};

type BooksInput = {
  prizeFirstAmount: number;
  prizeSecondAmount: number;
  prizeThirdAmount: number;
  otherCost: number;
  otherCostNote: string;
};

function placeOf(value: number): 0 | 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  return 0;
}

async function loadTournament(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError(404, "NOT_FOUND", "That tournament was not found.");
  const tournament = await Tournament.findById(id);
  if (!tournament) throw new AppError(404, "NOT_FOUND", "That tournament was not found.");
  return tournament;
}

async function symbol() {
  const settings = await getSettings();
  return settings.system.currencySymbol;
}

function entryView(row: {
  _id: unknown;
  name: string;
  phone?: string;
  teamName?: string;
  kind?: string;
  feeDue?: number;
  amountPaid?: number;
  place?: number;
  note?: string;
}): LedgerEntry {
  const feeDue = row.feeDue || 0;
  const amountPaid = row.amountPaid || 0;
  return {
    id: String(row._id),
    name: row.name,
    phone: row.phone || "",
    teamName: row.teamName || "",
    kind: row.kind === "late" ? "late" : "regular",
    feeDue,
    amountPaid,
    outstanding: Math.max(0, feeDue - amountPaid),
    place: placeOf(row.place || 0),
    note: row.note || "",
  };
}

export async function tournamentLedger(id: string): Promise<TournamentLedger> {
  const tournament = await loadTournament(id);
  const mark = await symbol();
  const rows = await TournamentEntry.find({ tournamentId: tournament._id }).sort({ createdAt: 1 }).lean();
  const entries = rows.map(entryView);
  const due = entries.reduce((sum, entry) => sum + entry.feeDue, 0);
  const collected = entries.reduce((sum, entry) => sum + entry.amountPaid, 0);
  const outstanding = entries.reduce((sum, entry) => sum + entry.outstanding, 0);
  const prizeCost = (tournament.prizeFirstAmount || 0) + (tournament.prizeSecondAmount || 0) + (tournament.prizeThirdAmount || 0);
  const otherCost = tournament.otherCost || 0;
  const profit = collected - prizeCost - otherCost;
  const expected = due - prizeCost - otherCost;
  return {
    currencySymbol: mark,
    title: tournament.title,
    format: tournament.format === "team" ? "team" : "solo",
    entryFee: tournament.entryFee || 0,
    lateEntryFee: tournament.lateEntryFee || 0,
    maxEntries: tournament.maxEntries || 0,
    prizeFirstAmount: tournament.prizeFirstAmount || 0,
    prizeSecondAmount: tournament.prizeSecondAmount || 0,
    prizeThirdAmount: tournament.prizeThirdAmount || 0,
    otherCost,
    otherCostNote: tournament.otherCostNote || "",
    entries,
    books: {
      count: entries.length,
      collected,
      due,
      outstanding,
      prizeCost,
      otherCost,
      profit,
      expected,
      collectedLabel: formatMoney(collected, mark),
      outstandingLabel: formatMoney(outstanding, mark),
      prizeCostLabel: formatMoney(prizeCost, mark),
      otherCostLabel: formatMoney(otherCost, mark),
      profitLabel: formatMoney(profit, mark),
      expectedLabel: formatMoney(expected, mark),
    },
  };
}

async function claimPlace(tournamentId: unknown, place: 0 | 1 | 2 | 3, ignoreId?: string) {
  if (!place) return;
  await TournamentEntry.updateMany(
    { tournamentId, place, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) },
    { $set: { place: 0 } },
  );
}

async function syncCount(tournamentId: unknown) {
  const count = await TournamentEntry.countDocuments({ tournamentId });
  await Tournament.updateOne({ _id: tournamentId }, { $set: { entriesTaken: count } });
}

export async function enrollPlayer(id: string, input: EntryInput, actor: Actor) {
  const tournament = await loadTournament(id);
  const count = await TournamentEntry.countDocuments({ tournamentId: tournament._id });
  if ((tournament.maxEntries || 0) > 0 && count >= tournament.maxEntries) {
    throw new AppError(400, "FULL", "This tournament is already at the maximum.");
  }
  const place = placeOf(input.place);
  await claimPlace(tournament._id, place);
  const created = await TournamentEntry.create({
    tournamentId: tournament._id,
    name: input.name,
    phone: input.phone,
    teamName: tournament.format === "team" ? input.teamName : "",
    kind: input.kind,
    feeDue: input.feeDue,
    amountPaid: input.amountPaid,
    place,
    note: input.note,
  });
  await syncCount(tournament._id);
  await writeAudit({
    actor,
    action: "tournament.enrolled",
    entity: "tournament",
    entityId: id,
    newValue: { name: input.name, kind: input.kind, feeDue: input.feeDue, amountPaid: input.amountPaid },
  });
  return tournamentLedger(String(created.tournamentId));
}

export async function updatePlayer(id: string, entryId: string, input: EntryInput, actor: Actor) {
  const tournament = await loadTournament(id);
  if (!/^[a-f\d]{24}$/i.test(entryId)) throw new AppError(404, "NOT_FOUND", "That entry was not found.");
  const entry = await TournamentEntry.findOne({ _id: entryId, tournamentId: tournament._id });
  if (!entry) throw new AppError(404, "NOT_FOUND", "That entry was not found.");
  const place = placeOf(input.place);
  await claimPlace(tournament._id, place, entryId);
  entry.name = input.name;
  entry.phone = input.phone;
  entry.teamName = tournament.format === "team" ? input.teamName : "";
  entry.kind = input.kind;
  entry.feeDue = input.feeDue;
  entry.amountPaid = input.amountPaid;
  entry.place = place;
  entry.note = input.note;
  await entry.save();
  await writeAudit({
    actor,
    action: "tournament.entry_updated",
    entity: "tournament",
    entityId: id,
    newValue: { name: input.name, feeDue: input.feeDue, amountPaid: input.amountPaid, place },
  });
  return tournamentLedger(id);
}

export async function removePlayer(id: string, entryId: string, actor: Actor) {
  const tournament = await loadTournament(id);
  if (!/^[a-f\d]{24}$/i.test(entryId)) throw new AppError(404, "NOT_FOUND", "That entry was not found.");
  const entry = await TournamentEntry.findOne({ _id: entryId, tournamentId: tournament._id });
  if (!entry) throw new AppError(404, "NOT_FOUND", "That entry was not found.");
  const name = entry.name;
  await entry.deleteOne();
  await syncCount(tournament._id);
  await writeAudit({ actor, action: "tournament.entry_removed", entity: "tournament", entityId: id, oldValue: { name } });
  return tournamentLedger(id);
}

export async function saveTournamentBooks(id: string, input: BooksInput, actor: Actor) {
  const tournament = await loadTournament(id);
  tournament.prizeFirstAmount = input.prizeFirstAmount;
  tournament.prizeSecondAmount = input.prizeSecondAmount;
  tournament.prizeThirdAmount = input.prizeThirdAmount;
  tournament.otherCost = input.otherCost;
  tournament.otherCostNote = input.otherCostNote;
  await tournament.save();
  await writeAudit({
    actor,
    action: "tournament.books_updated",
    entity: "tournament",
    entityId: id,
    newValue: {
      prizeFirstAmount: input.prizeFirstAmount,
      prizeSecondAmount: input.prizeSecondAmount,
      prizeThirdAmount: input.prizeThirdAmount,
      otherCost: input.otherCost,
    },
  });
  return tournamentLedger(id);
}
