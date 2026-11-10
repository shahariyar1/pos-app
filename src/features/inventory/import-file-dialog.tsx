"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage, revalidate } from "@/lib/fetcher";
import { analyse, buildPayload, type Analysis, type Sheet } from "@/lib/import-parse";
import { formatMoney } from "@/lib/utils";

type Result = { created: number; skipped: number; restocked: number; replaced: number };

const SAMPLE_CSV = `Name,Code,Group,Location,Cost,Price,Stock
Vivo Y21,Cover,Cover,C1,40,100,7
Samsung A12 display,A12 display,Display,B2,1500,2200,3
`;

function downloadSample() {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Upload an Excel, CSV or PDF, check the preview, and add the new items to Inventory (and the Cover finder). */
export function ImportFileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("100");
  const [stock, setStock] = useState("7");
  const [addCoverProducts, setAddCoverProducts] = useState(true);
  const [existing, setExisting] = useState<"skip" | "add_stock" | "replace">("skip");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setAnalysis(null);
    setBusy("reading");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/inventory/parse", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not read this file");
      setAnalysis(analyse((data as { sheets: Sheet[] }).sheets));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  const hasCovers = !!analysis && analysis.covers.length > 0;
  const needsNumbers =
    !!analysis &&
    (analysis.products.some((p) => p.costPrice === null || p.salePrice === null || p.stock === null) || (hasCovers && addCoverProducts));

  async function save() {
    if (!analysis) return;
    const d = { costPrice: Number(cost), salePrice: Number(price), stock: Number(stock) };
    if (needsNumbers && (cost.trim() === "" || !Number.isFinite(d.costPrice) || d.costPrice < 0 || !Number.isFinite(d.salePrice) || d.salePrice < 0 || !Number.isInteger(d.stock) || d.stock < 0)) {
      toast.error("Enter a cost price, sale price and a whole-number stock (0 or more)");
      return;
    }
    const payload = buildPayload(
      analysis,
      needsNumbers ? d : { costPrice: 0, salePrice: 0, stock: 0 },
      { addCoverGroups: false, addCoverProducts, existing },
    );
    if (!payload.products.length && !payload.coverGroups.length) {
      toast.error("Nothing to add with these options");
      return;
    }
    setBusy("saving");
    try {
      const r = await api<Result>("/api/inventory/import", { method: "POST", body: JSON.stringify(payload) });
      const parts = [
        r.created ? `${r.created} new products` : "",
        r.restocked ? `${r.restocked} restocked` : "",
        r.replaced ? `${r.replaced} updated` : "",
        r.skipped ? `${r.skipped} already existed` : "",
      ].filter(Boolean);
      toast.success("Import finished", { description: parts.join(" · ") || "Everything in the file was already there" });
      revalidate("/api/");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from a file</DialogTitle>
          <DialogDescription>
            Upload an Excel, CSV or PDF. Only new items are added, so you can safely upload an updated list again.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-dashed p-4">
          <input
            ref={input}
            type="file"
            accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt,.pdf"
            className="sr-only"
            id="import-file"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => input.current?.click()} disabled={busy !== null}>
              {busy === "reading" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
              {busy === "reading" ? "Reading…" : "Choose file"}
            </Button>
            <span className="text-sm text-muted-foreground">{fileName || "Excel, CSV or PDF, up to 4 MB"}</span>
            <button type="button" className="ml-auto text-sm font-medium underline" onClick={downloadSample}>
              Download sample file
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Product list: a header row with Name, Code, Group, Location, Cost, Price, Stock (only Name is required).
            Cover list: rows of phone models separated by “/”, with the location at the end of each row, like your cover sheet.
          </p>
        </div>

        {analysis && (
          <div className="space-y-4">
            <div className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground" aria-live="polite">
              {analysis.products.length > 0 && <p>Found <strong>{analysis.products.length}</strong> products in a product list.</p>}
              {hasCovers && (
                <p>
                  Found <strong>{analysis.covers.length}</strong> cover rows with{" "}
                  <strong>{analysis.covers.reduce((n, g) => n + g.models.length, 0)}</strong> phone models.
                </p>
              )}
              {analysis.warnings.map((w) => (
                <p key={w} className="mt-1 text-warn">{w}</p>
              ))}
            </div>

            {analysis.products.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      {["Name", "Code", "Group", "Location", "Cost", "Price", "Stock"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.products.slice(0, 6).map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{p.name}</td>
                        <td className="px-3 py-1.5">{p.code}</td>
                        <td className="px-3 py-1.5">{p.group || <span className="text-muted-foreground">None</span>}</td>
                        <td className="px-3 py-1.5">{p.location || "None"}</td>
                        <td className="px-3 py-1.5">{p.costPrice === null ? <em className="text-muted-foreground">default</em> : formatMoney(p.costPrice)}</td>
                        <td className="px-3 py-1.5">{p.salePrice === null ? <em className="text-muted-foreground">default</em> : formatMoney(p.salePrice)}</td>
                        <td className="px-3 py-1.5">{p.stock === null ? <em className="text-muted-foreground">default</em> : p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analysis.products.length > 6 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">…and {analysis.products.length - 6} more</p>}
              </div>
            )}

            {hasCovers && (
              <div className="space-y-2">
                <ul className="space-y-1 rounded-lg border p-3 text-sm">
                  {analysis.covers.slice(0, 5).map((g, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">{g.location}</span>
                      <span className="text-muted-foreground">{g.models.length} models: {g.models.slice(0, 4).join(", ")}{g.models.length > 4 ? "…" : ""}</span>
                    </li>
                  ))}
                  {analysis.covers.length > 5 && <li className="text-xs text-muted-foreground">…and {analysis.covers.length - 5} more rows</li>}
                </ul>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <Label htmlFor="imp-products" className="leading-snug">Create a product for each phone model (name, code “Cover”, group Cover, location)</Label>
                  <Switch id="imp-products" checked={addCoverProducts} onCheckedChange={setAddCoverProducts} />
                </div>
              </div>
            )}

            {needsNumbers && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="imp-cost">Cost price</Label>
                  <Input id="imp-cost" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imp-price">Sale price</Label>
                  <Input id="imp-price" type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imp-stock">Stock for each</Label>
                  <Input id="imp-stock" type="number" min="0" step="1" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-3">Used for every item that does not have its own number in the file.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="imp-existing">If an item already exists</Label>
              <Select value={existing} onValueChange={(v) => setExisting(v as "skip" | "add_stock" | "replace")}>
                <SelectTrigger id="imp-existing" className="w-full sm:w-[28rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Leave it as it is</SelectItem>
                  <SelectItem value="add_stock">Add the file's stock to it</SelectItem>
                  <SelectItem value="replace">Replace it with the file's data (location, cost, price, stock)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!analysis || busy !== null || (analysis.products.length === 0 && analysis.covers.length === 0)}>
            {busy === "saving" ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
