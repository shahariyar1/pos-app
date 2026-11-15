"use client";

import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, revalidate } from "@/lib/fetcher";

type Pair = { location: string; model: string };
type Preview = {
  locations: number;
  sheetPairs: number;
  currentPairs: number;
  unchangedPairs: number;
  addedCount: number;
  removedCount: number;
  addedSamples: Pair[];
  removedSamples: Pair[];
};

async function request<T>(method: "GET" | "POST"): Promise<T> {
  const response = await fetch("/api/covers/sync", {
    method,
    cache: "no-store",
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({ confirm: true }) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Cover sync failed");
  return data as T;
}

export function CoverSheetSync() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "sync" | null>(null);

  async function showPreview() {
    setBusy("preview");
    try {
      setPreview(await request<Preview>("GET"));
      setOpen(true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function confirmSync() {
    setBusy("sync");
    try {
      const result = await request<{ syncedLocations: number; syncedPairs: number }>("POST");
      toast.success("Cover list synced", {
        description: `${result.syncedPairs} model-location pairs across ${result.syncedLocations} locations`,
      });
      revalidate("/api/");
      setOpen(false);
      setPreview(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={showPreview} disabled={busy !== null}>
        {busy === "preview" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
        Google Sheets Sync
      </Button>
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Preview Google Sheets Sync</DialogTitle>
            <DialogDescription>
              The sheet will become the source of truth for Cover List only. Inventory stock, sales, orders and other records will not be changed.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3"><p className="text-muted-foreground">Models in sheet</p><p className="text-xl font-semibold">{preview.sheetPairs}</p></div>
                <div className="rounded-lg border p-3"><p className="text-muted-foreground">Locations</p><p className="text-xl font-semibold">{preview.locations}</p></div>
                <div className="rounded-lg border p-3"><p className="text-muted-foreground">Will be added</p><p className="text-xl font-semibold">{preview.addedCount}</p></div>
                <div className="rounded-lg border p-3"><p className="text-muted-foreground">Will be removed</p><p className="text-xl font-semibold">{preview.removedCount}</p></div>
              </div>
              <p className="text-muted-foreground">{preview.unchangedPairs} existing model-location pairs will remain.</p>

              {preview.addedSamples.length > 0 && (
                <div>
                  <p className="mb-1 font-medium">Examples to add</p>
                  <ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {preview.addedSamples.map((p, i) => <li key={i}>{p.model} <span className="text-muted-foreground">— Location {p.location}</span></li>)}
                  </ul>
                </div>
              )}
              {preview.removedSamples.length > 0 && (
                <div>
                  <p className="mb-1 font-medium">Examples to remove</p>
                  <ul className="max-h-28 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {preview.removedSamples.map((p, i) => <li key={i}>{p.model} <span className="text-muted-foreground">— Location {p.location}</span></li>)}
                  </ul>
                </div>
              )}
              <p className="rounded-lg bg-muted p-3 text-muted-foreground">
                Only identical Model + Location pairs are deduplicated. A model listed at two different locations stays at both.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy !== null}>Cancel</Button>
            <Button type="button" onClick={confirmSync} disabled={!preview || busy !== null || preview.sheetPairs === 0}>
              {busy === "sync" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Confirm & Sync Covers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
