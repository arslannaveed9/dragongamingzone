"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, notifyRefresh } from "@/components/admin/client";

export function FiguresLock({ unlocked, configured }: { unlocked: boolean; configured: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (unlocked) {
      try {
        await api("/api/figures", { method: "DELETE" });
        notifyRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not hide the figures.");
      }
      return;
    }
    setPassword("");
    setError("");
    setOpen(true);
  }

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      await api("/api/figures", { method: "POST", body: JSON.stringify({ password }) });
      setOpen(false);
      notifyRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not show the figures.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="icon" aria-label={unlocked ? "Hide financial figures" : "Show financial figures"} onClick={() => void toggle()}>
        {unlocked ? <Eye /> : <EyeOff />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{configured ? "Show financial figures" : "Figures password"}</DialogTitle>
          </DialogHeader>
          {configured ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Use the figures password from Settings. This is separate from the login password.</p>
              <Input
                type="password"
                name="figures-password"
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!busy && password.length >= 4) void unlock();
                  }
                }}
                placeholder="Figures password"
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="button" disabled={busy || password.length < 4} onClick={() => void unlock()}>{busy ? "Checking..." : "Show"}</Button>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">The owner sets this password in Settings. Until then, revenue and amounts stay hidden.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
