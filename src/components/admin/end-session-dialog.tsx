"use client";

import { useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, money, STATUS_LABEL } from "@/components/admin/client";
import { dragFooterClassName, dragHeaderClassName, draggablePanelClassName, useDraggablePanel } from "@/components/admin/draggable-panel";

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
  bookingId,
  customerName,
  paymentStatus,
  amountPaid,
  total,
  symbol,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  customerName?: string;
  paymentStatus: string;
  amountPaid: number;
  total: number | null;
  symbol: string;
  onConfirm: (payment?: { amount?: number; method: string; payRemainder?: boolean }) => void;
}) {
  const [snapshot, setSnapshot] = useState<{ status: string; paid: number; total: number } | null>(
    total == null ? null : { status: paymentStatus, paid: amountPaid, total },
  );
  const shownStatus = snapshot?.status ?? paymentStatus;
  const shownPaid = snapshot?.paid ?? amountPaid;
  const shownTotal = snapshot?.total ?? total;
  const due = shownTotal == null ? null : Math.max(0, Math.round((shownTotal - shownPaid) * 100) / 100);
  const unpaid = shownStatus === "unpaid" || shownStatus === "partial" || (due != null && due > 0);
  const [markPaid, setMarkPaid] = useState(unpaid);
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(due != null && due > 0 ? String(due) : "");
  const edited = useRef(false);
  const { panelRef, style, dragHandle } = useDraggablePanel(open);

  useEffect(() => {
    if (!open || !bookingId) return;
    let cancelled = false;
    api<{ booking: { paymentStatus: string; amountPaid: number; pricing: { finalAmount: number } } }>(`/api/bookings/${bookingId}`)
      .then((detail) => {
        if (cancelled) return;
        const paid = detail.booking.amountPaid || 0;
        const bill = detail.booking.pricing?.finalAmount ?? 0;
        const balance = Math.max(0, Math.round((bill - paid) * 100) / 100);
        setSnapshot({ status: detail.booking.paymentStatus || "unpaid", paid, total: bill });
        if (edited.current) return;
        setAmount(balance > 0 ? String(balance) : "");
        setMarkPaid(balance > 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  function confirm() {
    if (unpaid && markPaid) {
      const value = Number(amount);
      onConfirm(value > 0 ? { amount: value, method } : { method, payRemainder: true });
      return;
    }
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={panelRef} className={draggablePanelClassName} style={style}>
        <DialogHeader className={dragHeaderClassName} {...dragHandle}>
          <DialogTitle className="flex items-center gap-2">
            <GripHorizontal className="size-4 shrink-0 text-muted-foreground" />
            {unpaid ? "Balance still open" : "End booking"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain">
          {unpaid ? (
            <div className="space-y-3 text-base">
              <p>{customerName ? `${customerName} still has money to collect.` : "Money is still to collect on this booking."}</p>
              <p>Status: <strong>{STATUS_LABEL[shownStatus] || shownStatus}</strong></p>
              <p>Received: <strong>{money(shownPaid, symbol)}</strong>{shownTotal != null ? ` of ${money(shownTotal, symbol)}` : ""}</p>
              {due != null && due > 0 && <p className="font-heading text-xl font-bold text-rose-700 dark:text-rose-200">Balance {money(due, symbol)}</p>}
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[auto_1fr_7.5rem]">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={markPaid} onChange={(event) => setMarkPaid(event.target.checked)} />
                  Mark as paid
                </label>
                <select className="h-10 rounded-lg border border-input bg-background px-2 text-base disabled:opacity-50" value={method} disabled={!markPaid} onChange={(event) => setMethod(event.target.value)}>
                  {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Input value={amount} onChange={(event) => { edited.current = true; setAmount(event.target.value); }} inputMode="decimal" disabled={!markPaid} aria-label="Amount received" />
              </div>
              <p className="text-sm text-muted-foreground">A smaller amount stays as a balance. A running session is rebilled from the time played before this payment is saved.</p>
            </div>
          ) : (
            <p className="text-base text-muted-foreground">This booking is paid. The price is recalculated from the time played when a session is already running.</p>
          )}
        </div>
        <DialogFooter className={dragFooterClassName} {...dragHandle}>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep it</Button>
          <Button onClick={confirm}>{unpaid && markPaid ? "End and mark paid" : unpaid ? "End with balance" : "End booking"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
