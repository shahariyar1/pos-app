"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage, revalidate } from "@/lib/fetcher";
import { formatMoney } from "@/lib/utils";
import type { DashboardStats } from "@/types";

/** Profit stays hidden until the PIN is entered. The API refuses to compute it for locked sessions. */
export function ProfitCard({ stats }: { stats?: DashboardStats }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const profit = stats?.profit;

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/unlock", { method: "POST", body: JSON.stringify({ pin }) });
      setOpen(false);
      setPin("");
      revalidate("/api/"); // cost columns and profit now come back from the server
      toast.success("Profit unlocked for 15 minutes");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    await api("/api/auth/unlock", { method: "DELETE" });
    revalidate("/api/");
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Net profit</p>
          {profit ? (
            <Button variant="ghost" size="sm" onClick={lock}>
              <EyeOff className="size-4" aria-hidden /> Hide
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <Eye className="size-4" aria-hidden /> Show
            </Button>
          )}
        </div>
        {profit ? (
          <>
            <p className="text-2xl font-semibold">{formatMoney(profit.net)}</p>
            <p className="text-xs text-muted-foreground">
              Sales margin {formatMoney(profit.gross)} less returns {formatMoney(profit.returnsImpact)}
            </p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-2xl font-semibold text-muted-foreground">
              <Lock className="size-5" aria-hidden /> Hidden
            </p>
            <p className="text-xs text-muted-foreground">Enter the PIN to see profit and cost prices.</p>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={unlock} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Enter PIN</DialogTitle>
              <DialogDescription>Profit and cost prices stay hidden until you do.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="pin">PIN</Label>
              <Input id="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy || pin.length < 4}>
                {busy ? "Checking…" : "Unlock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
