"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage, fetcher, revalidate } from "@/lib/fetcher";
import { printSale } from "@/lib/print-memo";
import { DiscountField } from "@/components/discount-field";
import { discountAmount, type DiscountUnit } from "@/lib/discount";
import { cn, formatMoney, round2 } from "@/lib/utils";
import type { DsrResponse, OwnerOrder, Sale } from "@/types";

type Line = { productId: string; name: string; code: string; qty: number; unitPrice: number };

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Turn a customer's order into a memo. Quantities and prices can be changed first. */
export function ConfirmOrderDialog({ order, onClose }: { order: OwnerOrder | null; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>(() =>
    (order?.items ?? []).map((i) => ({ productId: i.product, name: i.name, code: i.code, qty: i.qty, unitPrice: i.unitPrice })),
  );
  const [dsr, setDsr] = useState(order?.dsr ?? "");
  const [paid, setPaid] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [discountUnit, setDiscountUnit] = useState<DiscountUnit>("amount");
  const [busy, setBusy] = useState(false);
  const { data: dsrList } = useSWR<DsrResponse>(order ? "/api/dsr" : null, fetcher);

  if (!order) return null;
  const current = order;

  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const previousDue = current.due ?? 0;
  const discount = discountAmount(subtotal, Number(discountText), discountUnit);
  const grandTotal = round2(subtotal - discount + previousDue);
  const payable = Math.max(grandTotal, 0);
  const received = Math.min(num(paid), payable);
  const dueAfter = round2(grandTotal - received);

  const setLine = (id: string, patch: Partial<Line>) => setLines((p) => p.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  async function confirm() {
    setBusy(true);
    try {
      const res = await api<{ sale: Sale; orderNo: string }>(`/api/orders/${current._id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })), paid: received, dsr, discount }),
      });
      toast.success(`${res.sale.invoiceNo} created for ${current.shopName}`, {
        description: `From ${res.orderNo}`,
        action: { label: "Print memo", onClick: () => printSale(res.sale) },
        duration: 12_000,
      });
      revalidate("/api/");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm {current.orderNo}</DialogTitle>
          <DialogDescription>
            {current.shopName}{current.phone ? ` · ${current.phone}` : ""}. This becomes a memo and takes the items out of stock.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.productId} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{l.code}</p>
                </div>
                <Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-8" aria-label={`Remove ${l.name}`} disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((x) => x.productId !== l.productId))}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Input aria-label={`Quantity of ${l.name}`} inputMode="numeric" className="h-9 w-16 px-1 text-center" value={l.qty} onChange={(e) => setLine(l.productId, { qty: Math.max(1, Math.floor(num(e.target.value))) })} />
                <div className="flex items-center gap-2">
                  <Input aria-label={`Price for ${l.name}`} type="number" min="0" step="0.01" inputMode="decimal" className="h-9 w-24 text-right" value={l.unitPrice} onChange={(e) => setLine(l.productId, { unitPrice: num(e.target.value) })} />
                  <span className="w-24 text-right font-medium">{formatMoney(l.qty * l.unitPrice)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {current.note && <p className="rounded-lg bg-muted/50 p-3 text-sm">Customer's note: {current.note}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="co-dsr">Sold by (DSR)</Label>
          <Select value={dsr || "none"} onValueChange={(v) => setDsr(v === "none" ? "" : v)}>
            <SelectTrigger id="co-dsr" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nobody</SelectItem>
              {dsrList?.data.map((d) => (
                <SelectItem key={d._id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd>{formatMoney(subtotal)}</dd></div>
          {discount > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd>- {formatMoney(discount)}</dd></div>}
          {previousDue !== 0 && (
            <div className={cn("flex justify-between", previousDue > 0 && "text-warn")}>
              <dt>{previousDue > 0 ? "Previous due" : "Store credit"}</dt>
              <dd>{formatMoney(previousDue)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Grand total</dt><dd>{formatMoney(grandTotal)}</dd></div>
        </dl>

        <DiscountField id="co-discount" value={discountText} unit={discountUnit} amount={discount} onChange={(v, u) => { setDiscountText(v); setDiscountUnit(u); }} />

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="co-paid">Received now</Label>
            <Input id="co-paid" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </div>
          <Button variant="outline" disabled={payable <= 0} onClick={() => setPaid(String(payable))}>
            <Check className="size-4" aria-hidden /> Full amount
          </Button>
        </div>
        <p className="flex justify-between text-sm">
          <span className="text-muted-foreground">Due after this memo</span>
          <span className={cn("font-semibold", dueAfter > 0 && "text-warn")}>{formatMoney(dueAfter)}</span>
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy || lines.length === 0}>
            {busy ? "Creating memo…" : "Confirm and create memo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
