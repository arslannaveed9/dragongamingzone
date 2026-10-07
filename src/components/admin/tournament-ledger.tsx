"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/components/admin/client";
import type { LedgerEntry, TournamentLedger } from "@/services/tournament-ledger-service";

const placeLabel = ["", "1st", "2nd", "3rd"];

export function TournamentLedgerPanel({ tournamentId, onChanged, onClose }: { tournamentId: string; onChanged: (ledger: TournamentLedger) => void; onClose: () => void }) {
  const [ledger, setLedger] = useState<TournamentLedger | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [teamName, setTeamName] = useState("");
  const [kind, setKind] = useState<"regular" | "late">("regular");
  const [feeDue, setFeeDue] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [note, setNote] = useState("");
  const [books, setBooks] = useState({ prizeFirstAmount: 0, prizeSecondAmount: 0, prizeThirdAmount: 0, otherCost: 0, otherCostNote: "" });
  const [pending, setPending] = useState<"books" | "enroll" | null>(null);

  async function load() {
    const next = await api<TournamentLedger>(`/api/tournaments/${tournamentId}/ledger`);
    setLedger(next);
    setBooks({
      prizeFirstAmount: next.prizeFirstAmount,
      prizeSecondAmount: next.prizeSecondAmount,
      prizeThirdAmount: next.prizeThirdAmount,
      otherCost: next.otherCost,
      otherCostNote: next.otherCostNote,
    });
    return next;
  }

  useEffect(() => {
    load().then((next) => {
      setFeeDue(next.entryFee);
      setAmountPaid(next.entryFee);
    }).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not load entries.");
    });
  }, [tournamentId]);

  function chooseKind(next: "regular" | "late") {
    if (!ledger) return;
    const fee = next === "late" ? ledger.lateEntryFee : ledger.entryFee;
    setKind(next);
    setFeeDue(fee);
    setAmountPaid(fee);
  }

  async function enroll() {
    if (!name.trim()) {
      toast.error("Add the player's name.");
      return;
    }
    setPending("enroll");
    try {
      const next = await api<TournamentLedger>(`/api/tournaments/${tournamentId}/entries`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), teamName: teamName.trim(), kind, feeDue, amountPaid, place: 0, note: note.trim() }),
      });
      setLedger(next);
      setName("");
      setPhone("");
      setTeamName("");
      setNote("");
      toast.success("Player enrolled.");
      onChanged(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enroll that player.");
    } finally {
      setPending(null);
    }
  }

  async function saveEntry(entry: LedgerEntry, patch: Partial<LedgerEntry>) {
    const nextEntry = { ...entry, ...patch };
    try {
      const next = await api<TournamentLedger>(`/api/tournaments/${tournamentId}/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: nextEntry.name,
          phone: nextEntry.phone,
          teamName: nextEntry.teamName,
          kind: nextEntry.kind,
          feeDue: nextEntry.feeDue,
          amountPaid: nextEntry.amountPaid,
          place: nextEntry.place,
          note: nextEntry.note,
        }),
      });
      setLedger(next);
      onChanged(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that entry.");
    }
  }

  async function remove(entry: LedgerEntry) {
    try {
      const next = await api<TournamentLedger>(`/api/tournaments/${tournamentId}/entries/${entry.id}`, { method: "DELETE" });
      setLedger(next);
      toast.success("Entry removed.");
      onChanged(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove that entry.");
    }
  }

  async function saveBooks() {
    setPending("books");
    try {
      const next = await api<TournamentLedger>(`/api/tournaments/${tournamentId}/ledger`, { method: "PATCH", body: JSON.stringify(books) });
      setLedger(next);
      toast.success("Prize and cost figures saved.");
      onChanged(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the figures.");
    } finally {
      setPending(null);
    }
  }

  if (!ledger) return <p className="text-sm text-muted-foreground">Loading entries...</p>;
  const symbol = ledger.currencySymbol;

  return (
    <section className="gz-panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{ledger.title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Figure label="Collected" value={ledger.books.collectedLabel} />
        <Figure label="Still to collect" value={ledger.books.outstandingLabel} />
        <Figure label="Prize money" value={ledger.books.prizeCostLabel} />
        <Figure label="Other costs" value={ledger.books.otherCostLabel} />
        <Figure label="Profit now" value={ledger.books.profitLabel} />
        <Figure label="If everyone pays" value={ledger.books.expectedLabel} />
      </div>
      <p className="text-sm text-muted-foreground">Profit now is money collected, minus 1st, 2nd, and 3rd prize amounts, minus other costs. If everyone pays uses the fees owed instead of what is already in hand.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={`1st prize (${symbol})`}><Input type="number" min={0} value={books.prizeFirstAmount} onChange={(event) => setBooks({ ...books, prizeFirstAmount: Number(event.target.value) })} /></Field>
        <Field label={`2nd prize (${symbol})`}><Input type="number" min={0} value={books.prizeSecondAmount} onChange={(event) => setBooks({ ...books, prizeSecondAmount: Number(event.target.value) })} /></Field>
        <Field label={`3rd prize (${symbol})`}><Input type="number" min={0} value={books.prizeThirdAmount} onChange={(event) => setBooks({ ...books, prizeThirdAmount: Number(event.target.value) })} /></Field>
        <Field label={`Other costs (${symbol})`}><Input type="number" min={0} value={books.otherCost} onChange={(event) => setBooks({ ...books, otherCost: Number(event.target.value) })} /></Field>
        <Field label="What the other costs are"><Input value={books.otherCostNote} placeholder="Snacks, extra station time" onChange={(event) => setBooks({ ...books, otherCostNote: event.target.value })} /></Field>
      </div>
      <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void saveBooks()}>{pending === "books" ? "Saving..." : "Save prize and costs"}</Button>

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="font-medium">Enroll a player</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
          {ledger.format === "team" ? <Field label="Team"><Input value={teamName} onChange={(event) => setTeamName(event.target.value)} /></Field> : null}
          <Field label={`Fee due (${symbol})`}><Input type="number" min={0} value={feeDue} onChange={(event) => setFeeDue(Number(event.target.value))} /></Field>
          <Field label={`Paid now (${symbol})`}><Input type="number" min={0} value={amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value))} /></Field>
          <Field label="Note"><Input value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={kind === "regular" ? "default" : "outline"} onClick={() => chooseKind("regular")}>Regular fee</Button>
          <Button type="button" variant={kind === "late" ? "default" : "outline"} onClick={() => chooseKind("late")}>Late fee</Button>
          <Button type="button" disabled={pending !== null} onClick={() => void enroll()}>{pending === "enroll" ? "Saving..." : "Enroll"}</Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Enrolled · {ledger.books.count}{ledger.maxEntries > 0 ? ` of ${ledger.maxEntries}` : ""}</h3>
        {ledger.entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} symbol={symbol} onSave={saveEntry} onRemove={remove} />
        ))}
        {ledger.entries.length === 0 ? <p className="text-sm text-muted-foreground">No one is enrolled yet.</p> : null}
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-bold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm"><Label>{label}</Label>{children}</label>;
}

function EntryRow({
  entry,
  symbol,
  onSave,
  onRemove,
}: {
  entry: LedgerEntry;
  symbol: string;
  onSave: (entry: LedgerEntry, patch: Partial<LedgerEntry>) => Promise<void>;
  onRemove: (entry: LedgerEntry) => Promise<void>;
}) {
  const [paid, setPaid] = useState(entry.amountPaid);
  const [due, setDue] = useState(entry.feeDue);
  useEffect(() => {
    setPaid(entry.amountPaid);
    setDue(entry.feeDue);
  }, [entry.amountPaid, entry.feeDue]);

  return (
    <article className="rounded-xl border border-border px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{entry.name}{entry.teamName ? ` · ${entry.teamName}` : ""}</p>
          <p className="text-sm text-muted-foreground">{entry.phone || "No phone"} · {entry.kind === "late" ? "Late entry" : "Regular entry"}{entry.place ? ` · ${placeLabel[entry.place]}` : ""}</p>
          <p className="text-sm text-muted-foreground">Owes {symbol} {entry.outstanding}{entry.note ? ` · ${entry.note}` : ""}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void onRemove(entry)}>Remove</Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Fee due</span><Input type="number" min={0} value={due} onChange={(event) => setDue(Number(event.target.value))} /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">Paid</span><Input type="number" min={0} value={paid} onChange={(event) => setPaid(Number(event.target.value))} /></label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Place</span>
          <select className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm" value={entry.place} onChange={(event) => void onSave(entry, { place: Number(event.target.value) as 0 | 1 | 2 | 3 })}>
            <option value={0}>Not placed</option>
            <option value={1}>1st</option>
            <option value={2}>2nd</option>
            <option value={3}>3rd</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={() => void onSave(entry, { feeDue: due, amountPaid: paid })}>Update payment</Button>
        </div>
      </div>
    </article>
  );
}
