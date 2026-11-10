"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage, fetcher, revalidate } from "@/lib/fetcher";
import type { DsrResponse } from "@/types";

/** Add or remove the salespeople (DSRs) who sell for you. Old memos keep the name of whoever sold them. */
export function DsrDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useSWR<DsrResponse>(open ? "/api/dsr" : null, fetcher);

  async function add() {
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    try {
      await api("/api/dsr", { method: "POST", body: JSON.stringify({ name: value }) });
      setName("");
      revalidate("/api/dsr");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    try {
      await api(`/api/dsr/${id}`, { method: "DELETE" });
      toast.success(`${label} removed`);
      revalidate("/api/dsr");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>DSR list</DialogTitle>
          <DialogDescription>People who sell for you. Pick one on each memo to see their daily total.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="dsr-name">Add a DSR</Label>
          <div className="flex gap-2">
            <Input
              id="dsr-name"
              autoFocus
              autoComplete="off"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} disabled={busy || !name.trim()}>
              <Plus className="size-4" aria-hidden /> Add
            </Button>
          </div>
        </div>

        <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
          {data?.data.length ? (
            data.data.map((d) => (
              <li key={d._id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium">{d.name}</span>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${d.name}`} onClick={() => remove(d._id, d.name)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))
          ) : (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">No DSR yet. Add the first one above.</li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
