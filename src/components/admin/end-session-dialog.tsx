"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { money, STATUS_LABEL } from "@/components/admin/client";

const METHODS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["easypaisa", "EasyPaisa"],
  ["jazzcash", "JazzCash"],
  ["other", "Other"],
] as const;

export function EndSessionDialog({
  open,
  onOpenChange,
  customerName,
  paymentStatus,
  amountPaid,
  total,
  symbol,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName?: string;
  paymentStatus: string;
  amountPaid: number;
  total: number | null;
  symbol: string;
  onConfirm: (payment?: { amount: number; method: string }) => void;
}) {
  const due = total == null ? null : Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  const unpaid = paymentStatus === "unpaid" || paymentStatus === "partial" || (due != null && due > 0);
  const [markPaid, setMarkPaid] = useState(unpaid);
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(due != null && due > 0 ? String(due) : "");

  function confirm() {
    if (unpaid && markPaid) {
      const value = Number(amount);
      onConfirm(value > 0 ? { amount: value, method } : undefined);
      return;
    }
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{unpaid ? "Balance still open" : "End booking"}</DialogTitle>
        </DialogHeader>
        {unpaid ? (
          <div className="space-y-3 text-base">
            <p>{customerName ? `${customerName} still has money to collect.` : "Money is still to collect on this booking."}</p>
            <p>Status: <strong>{STATUS_LABEL[paymentStatus] || paymentStatus}</strong></p>
            <p>Received: <strong>{money(amountPaid, symbol)}</strong>{total != null ? ` of ${money(total, symbol)}` : ""}</p>
            {due != null && due > 0 && <p className="font-heading text-xl font-bold text-rose-700 dark:text-rose-200">Balance {money(due, symbol)}</p>}
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[auto_1fr_7.5rem]">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={markPaid} onChange={(event) => setMarkPaid(event.target.checked)} />
                Mark as paid
              </label>
              <select className="h-10 rounded-lg border border-input bg-background px-2 text-base disabled:opacity-50" value={method} disabled={!markPaid} onChange={(event) => setMethod(event.target.value)}>
                {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={!markPaid} aria-label="Amount received" />
            </div>
            <p className="text-sm text-muted-foreground">A smaller amount stays as a balance. A running session is rebilled from the time played before this payment is saved.</p>
          </div>
        ) : (
          <p className="text-base text-muted-foreground">This booking is paid. The price is recalculated from the time played when a session is already running.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep it</Button>
          <Button onClick={confirm}>{unpaid && markPaid ? "End and mark paid" : unpaid ? "End with balance" : "End booking"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
