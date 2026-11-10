"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Minus, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { EntitySearch } from "@/components/entity-search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage, fetcher, qs, revalidate } from "@/lib/fetcher";
import { DiscountField } from "@/components/discount-field";
import { discountAmount, type DiscountUnit } from "@/lib/discount";
import { cn, formatMoney, round2 } from "@/lib/utils";
import type { DsrResponse, Product, ProductsResponse, Sale } from "@/types";

type Existing = { index: number; name: string; code: string; originalQty: number; qty: number; originalPrice: number; unitPrice: number };
type Added = { productId: string; name: string; code: string; qty: number; unitPrice: number; stock: number };
type Outcome = "stock" | "damaged" | "none";
type Returned = { key: number; productId?: string; name: string; code: string; qty: number; unitPrice: number; outcome: Outcome };

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * Edit a saved memo: reduce or remove items, add products, record items returned after the sale (optional),
 * and receive money. Everything is saved together when you press Save.
 */
export function EditSaleDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const [existing, setExisting] = useState<Existing[]>(() =>
    (sale?.items ?? []).map((i, index) => ({ index, name: i.name, code: i.code, originalQty: i.qty, qty: i.qty, originalPrice: i.unitPrice, unitPrice: i.unitPrice })),
  );
  const [added, setAdded] = useState<Added[]>([]);
  const [returns, setReturns] = useState<Returned[]>([]);
  const [refundMode, setRefundMode] = useState<"credit" | "cash">("credit");
  const [extraPaid, setExtraPaid] = useState("");
  const [addText, setAddText] = useState("");
  const [retText, setRetText] = useState("");
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dsr, setDsr] = useState(sale?.dsr ?? "");
  const [discountText, setDiscountText] = useState(sale?.discount ? String(sale.discount) : "");
  const [discountUnit, setDiscountUnit] = useState<DiscountUnit>("amount");
  const dAdd = useDebounce(addText.trim(), 200);
  const dRet = useDebounce(retText.trim(), 200);

  const { data: addFound } = useSWR<ProductsResponse>(sale ? `/api/products${qs({ q: dAdd, limit: 8 })}` : null, fetcher);
  const { data: dsrList } = useSWR<DsrResponse>(sale ? "/api/dsr" : null, fetcher);
  const { data: retFound } = useSWR<ProductsResponse>(sale ? `/api/products${qs({ q: dRet, limit: 8 })}` : null, fetcher);

  if (!sale) return null;
  const current = sale;

  /* ---- live totals (the server recalculates everything when you save) ---- */
  const subtotal = round2(
    existing.reduce((s, l) => s + l.qty * l.unitPrice, 0) + added.reduce((s, l) => s + l.qty * l.unitPrice, 0),
  );
  const newReturns = round2(returns.reduce((s, r) => s + r.qty * r.unitPrice, 0));
  const returnTotal = round2((current.returnTotal ?? 0) + newReturns);
  const discount = discountAmount(subtotal, Number(discountText), discountUnit);
  const grandTotal = round2(subtotal - discount + current.previousDue - returnTotal);
  let base = current.paid;
  if (newReturns > 0 && refundMode === "cash") base = Math.max(0, round2(base - newReturns));
  if (!current.customer) base = Math.min(base, Math.max(grandTotal, 0));
  const room = Math.max(round2(grandTotal - base), 0);
  const received = Math.min(num(extraPaid), room);
  const paid = round2(base + received);
  const dueAfter = round2(grandTotal - paid);

  const changedLines = existing.filter((l) => l.qty !== l.originalQty || l.unitPrice !== l.originalPrice);
  const validReturns = returns.filter((r) => r.qty >= 1 && r.name.trim() !== "");
  const dsrChanged = dsr !== (current.dsr ?? "");
  const discountChanged = discount !== round2(current.discount ?? 0);
  const changed = dsrChanged || discountChanged || changedLines.length > 0 || added.length > 0 || validReturns.length > 0 || received > 0;
  const emptyMemo = existing.every((l) => l.qty === 0) && added.length === 0;
  const unnamedReturn = returns.some((r) => r.name.trim() === "");

  const setLine = (index: number, patch: Partial<Existing>) => setExisting((p) => p.map((l) => (l.index === index ? { ...l, ...patch } : l)));
  const setAdd = (id: string, patch: Partial<Added>) => setAdded((p) => p.map((l) => (l.productId === id ? { ...l, ...patch } : l)));
  const setRet = (key: number, patch: Partial<Returned>) => setReturns((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function addProduct(p: Product) {
    if (p.stock <= 0) {
      toast.error(`${p.name} is out of stock`);
      return;
    }
    setAdded((prev) =>
      prev.some((l) => l.productId === p._id)
        ? prev.map((l) => (l.productId === p._id ? { ...l, qty: Math.min(l.qty + 1, p.stock) } : l))
        : [...prev, { productId: p._id, name: p.name, code: p.code, qty: 1, unitPrice: p.salePrice, stock: p.stock }],
    );
    setAddText("");
  }

  function addReturn(p?: Product) {
    setReturns((prev) => [
      ...prev,
      { key: nextKey, productId: p?._id, name: p?.name ?? "", code: p?.code ?? "", qty: 1, unitPrice: p?.salePrice ?? 0, outcome: p ? "stock" : "none" },
    ]);
    setNextKey((k) => k + 1);
    setRetText("");
  }

  async function save() {
    if (emptyMemo) {
      toast.error("A memo needs at least one item. Use Delete memo to remove the whole memo.");
      return;
    }
    if (unnamedReturn) {
      toast.error("Give each returned item a name, or remove the empty row");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/sales/${current._id}`, {
        method: "PATCH",
        body: JSON.stringify({
          lines: changedLines.map((l) => ({ index: l.index, qty: l.qty, unitPrice: l.unitPrice })),
          add: added.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
          returns: validReturns.map((r) => ({ productId: r.productId, name: r.name.trim(), code: r.code.trim(), qty: r.qty, unitPrice: r.unitPrice, restock: r.outcome === "stock", damaged: r.outcome === "damaged" })),
          refundMode,
          extraPaid: received,
          dsr: dsrChanged ? dsr : undefined,
          discount: discountChanged ? discount : undefined,
        }),
      });
      toast.success(`${current.invoiceNo} updated`);
      revalidate("/api/");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const productRow = (p: Product) => (
    <div className="flex items-center justify-between gap-2">
      <span>
        <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">{p.code}</span>
        {p.location && <span className="text-muted-foreground"> · {p.location}</span>}
      </span>
      <span className={cn("text-sm", p.stock <= 0 ? "text-destructive" : "text-muted-foreground")}>
        {p.stock <= 0 ? "Out of stock" : `${p.stock} · ${formatMoney(p.salePrice)}`}
      </span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {current.invoiceNo}</DialogTitle>
          <DialogDescription>
            {current.customerName}. Reduce or remove items, add products, or record returns. Nothing is saved until you press Save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="edit-dsr">Sold by (DSR)</Label>
          <Select value={dsr || "none"} onValueChange={(v) => setDsr(v === "none" ? "" : v)}>
            <SelectTrigger id="edit-dsr" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nobody</SelectItem>
              {dsrList?.data.map((d) => (
                <SelectItem key={d._id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
              {dsr && !dsrList?.data.some((d) => d.name === dsr) && <SelectItem value={dsr}>{dsr}</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* 1. items already on the memo */}
        <section className="space-y-2" aria-label="Items on this memo">
          <h3 className="text-sm font-semibold">Items on this memo</h3>
          <ul className="space-y-2">
            {existing.map((l) => {
              const removed = l.qty === 0;
              return (
                <li key={l.index} className={cn("rounded-lg border p-3", removed && "bg-muted/50")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn("truncate text-sm font-medium", removed && "text-muted-foreground line-through")}>{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.code}</p>
                    </div>
                    {removed ? (
                      <Button variant="ghost" size="sm" onClick={() => setLine(l.index, { qty: l.originalQty })}>
                        <Undo2 className="size-4" aria-hidden /> Undo
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-8" aria-label={`Remove ${l.name}`} onClick={() => setLine(l.index, { qty: 0 })}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {!removed && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="size-9" aria-label="Reduce quantity" onClick={() => setLine(l.index, { qty: l.qty - 1 })}>
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          aria-label={`Quantity of ${l.name}`}
                          inputMode="numeric"
                          className="h-9 w-14 px-1 text-center"
                          value={l.qty}
                          onChange={(e) => setLine(l.index, { qty: Math.min(Math.floor(num(e.target.value)), l.originalQty) })}
                        />
                        <Button variant="outline" size="icon" className="size-9" aria-label="Increase quantity" disabled={l.qty >= l.originalQty} onClick={() => setLine(l.index, { qty: l.qty + 1 })}>
                          <Plus className="size-4" />
                        </Button>
                        <span className="pl-1 text-xs text-muted-foreground">of {l.originalQty}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label={`Price for ${l.name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="h-9 w-24 text-right"
                          value={l.unitPrice}
                          onChange={(e) => setLine(l.index, { unitPrice: num(e.target.value) })}
                        />
                        <span className="w-20 text-right font-medium">{formatMoney(l.qty * l.unitPrice)}</span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* 2. add products */}
        <section className="space-y-2" aria-label="Add products">
          <Label htmlFor="edit-add" className="text-sm font-semibold">Add products</Label>
          <EntitySearch<Product>
            id="edit-add"
            placeholder="Search by code or name"
            value={addText}
            onValueChange={setAddText}
            results={addFound?.data ?? []}
            getKey={(p) => p._id}
            onPick={addProduct}
            renderItem={productRow}
          />
          {added.length > 0 && (
            <ul className="space-y-2">
              {added.map((l) => (
                <li key={l.productId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input aria-label={`Quantity of ${l.name}`} inputMode="numeric" className="h-9 w-16 px-1 text-center" value={l.qty} onChange={(e) => setAdd(l.productId, { qty: Math.max(1, Math.min(Math.floor(num(e.target.value)), l.stock)) })} />
                    <Input aria-label={`Price for ${l.name}`} type="number" min="0" step="0.01" inputMode="decimal" className="h-9 w-24 text-right" value={l.unitPrice} onChange={(e) => setAdd(l.productId, { unitPrice: num(e.target.value) })} />
                    <span className="w-20 text-right font-medium">{formatMoney(l.qty * l.unitPrice)}</span>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${l.name}`} onClick={() => setAdded((p) => p.filter((x) => x.productId !== l.productId))}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. returns (optional) */}
        <section className="space-y-2 rounded-lg border bg-muted/30 p-3" aria-label="Returns after sale">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Returns after sale <span className="font-normal text-muted-foreground">(optional)</span></h3>
            <Button variant="outline" size="sm" onClick={() => addReturn()}>
              <Plus className="size-4" aria-hidden /> Add by hand
            </Button>
          </div>
          <EntitySearch<Product>
            id="edit-return"
            placeholder="Search a product that came back"
            value={retText}
            onValueChange={setRetText}
            results={retFound?.data ?? []}
            getKey={(p) => p._id}
            onPick={(p) => addReturn(p)}
            renderItem={productRow}
          />
          {returns.length > 0 && (
            <>
              <ul className="space-y-2">
                {returns.map((r) => (
                  <li key={r.key} className="space-y-2 rounded-lg border bg-card p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                      <Input aria-label="Returned item name" placeholder="Item name" value={r.name} onChange={(e) => setRet(r.key, { name: e.target.value })} />
                      <Input aria-label="Returned item code" placeholder="Code" value={r.code} onChange={(e) => setRet(r.key, { code: e.target.value })} />
                    </div>
                    <div className="flex flex-wrap items-center gap-1 rounded-lg border p-1" role="group" aria-label="What happened to this item">
                      {r.productId && (
                        <Button size="sm" variant={r.outcome === "stock" ? "default" : "ghost"} aria-pressed={r.outcome === "stock"} onClick={() => setRet(r.key, { outcome: "stock" })}>
                          Back in stock
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={r.outcome === "damaged" ? "destructive" : "ghost"}
                        aria-pressed={r.outcome === "damaged"}
                        onClick={() => setRet(r.key, { outcome: r.outcome === "damaged" ? (r.productId ? "stock" : "none") : "damaged" })}
                      >
                        Damage
                      </Button>
                      {!r.productId && r.outcome !== "damaged" && <span className="px-2 text-xs text-muted-foreground">Not linked to a product, so stock is unchanged</span>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Input aria-label={`Quantity returned: ${r.name || "item"}`} inputMode="numeric" className="h-9 w-16 px-1 text-center" value={r.qty} onChange={(e) => setRet(r.key, { qty: Math.max(1, Math.floor(num(e.target.value))) })} />
                        <Input aria-label={`Return price: ${r.name || "item"}`} type="number" min="0" step="0.01" inputMode="decimal" className="h-9 w-24 text-right" value={r.unitPrice} onChange={(e) => setRet(r.key, { unitPrice: num(e.target.value) })} />
                        <span className="min-w-24 whitespace-nowrap text-right font-medium">- {formatMoney(r.qty * r.unitPrice)}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Remove returned item" onClick={() => setReturns((p) => p.filter((x) => x.key !== r.key))}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="edit-refund" className="text-sm">Refund as</Label>
                <Select value={refundMode} onValueChange={(v) => setRefundMode(v as "credit" | "cash")}>
                  <SelectTrigger id="edit-refund" className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Reduce what is due</SelectItem>
                    <SelectItem value="cash">Cash back now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </section>

        {/* 4. totals and payment */}
        <section className="space-y-3" aria-label="Totals">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd>{formatMoney(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd>- {formatMoney(discount)}</dd></div>}
            {returnTotal > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Returned items</dt><dd>- {formatMoney(returnTotal)}</dd></div>}
            {current.previousDue !== 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Previous due</dt><dd>{formatMoney(current.previousDue)}</dd></div>}
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Grand total</dt><dd>{formatMoney(grandTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Already paid</dt><dd>{formatMoney(base)}</dd></div>
          </dl>
          <DiscountField id="edit-discount" value={discountText} unit={discountUnit} amount={discount} onChange={(v, u) => { setDiscountText(v); setDiscountUnit(u); }} />
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="edit-paid">Received now</Label>
              <Input id="edit-paid" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={extraPaid} onChange={(e) => setExtraPaid(e.target.value)} />
            </div>
            <Button variant="outline" disabled={room <= 0} onClick={() => setExtraPaid(String(room))}>
              <Check className="size-4" aria-hidden /> Receive all {room > 0 ? formatMoney(room) : ""}
            </Button>
          </div>
          <p className="flex justify-between text-sm">
            <span className="text-muted-foreground">{dueAfter < 0 ? "Customer credit after saving" : "Due after saving"}</span>
            <span className={cn("font-semibold", dueAfter > 0 && "text-warn", dueAfter < 0 && "text-success")}>{formatMoney(Math.abs(dueAfter))}</span>
          </p>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !changed || emptyMemo}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
