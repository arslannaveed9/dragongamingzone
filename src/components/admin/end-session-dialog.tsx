"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money, STATUS_LABEL } from "@/components/admin/client";

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
  onConfirm: () => void;
}) {
  const due = total == null ? null : Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  const unpaid = paymentStatus === "unpaid" || paymentStatus === "partial" || (due != null && due > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{unpaid ? "Balance still open" : "End booking"}</DialogTitle>
        </DialogHeader>
        {unpaid ? (
          <div className="space-y-2 text-base">
            <p>{customerName ? `${customerName} still has money to collect.` : "Money is still to collect on this booking."}</p>
            <p>Status: <strong>{STATUS_LABEL[paymentStatus] || paymentStatus}</strong></p>
            <p>Received: <strong>{money(amountPaid, symbol)}</strong>{total != null ? ` of ${money(total, symbol)}` : ""}</p>
            {due != null && due > 0 && <p className="font-heading text-xl font-bold text-rose-700 dark:text-rose-200">Balance {money(due, symbol)}</p>}
            <p className="text-sm text-muted-foreground">A smaller payment is allowed. Ending the booking keeps that balance on the record.</p>
          </div>
        ) : (
          <p className="text-base text-muted-foreground">This booking is paid. The price is recalculated from the time played when a session is already running.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep it</Button>
          <Button onClick={onConfirm}>{unpaid ? "End with balance" : "End booking"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
