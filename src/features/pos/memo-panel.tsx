"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Minus, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DsrDialog } from "@/features/dsr/dsr-dialog";
import { useRouter } from "next/navigation";
import { api, errorMessage, fetcher, revalidate } from "@/lib/fetcher";
import { SHOP_NAME } from "@/lib/shop";
import { cn, formatMoney, round2 } from "@/lib/utils";
import { DiscountField } from "@/components/discount-field";
import { discountAmount } from "@/lib/discount";
import { cartSubtotal, useCart } from "@/stores/cart-store";
import type { DsrResponse, Sale } from "@/types";
import { CustomerPicker } from "./customer-picker";

/** Click-to-edit price. Keeps its own text while focused so "12." and "" can be typed freely. */
function PriceInput({ value, label, onCommit }: { value: number; label: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="h-9 w-24 text-right"
      value={focused ? text : String(value)}
      onFocus={(e) => {
        setText(String(value));
        setFocused(true);
        e.target.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= 0) onCommit(n);
      }}
      onBlur={() => setFocused(false)}
    />
  );
}

/** Quantity box: tap and type any number (20, 30...). Saves when you leave the box or press Enter. */
function QtyInput({ value, label, onCommit }: { value: number; label: string; onCommit: (n: number) => Promise<void> }) {
  const [text, setText] = useState(String(value));
  const [active, setActive] = useState(false);

  async function commit() {
    const n = Math.floor(Number(text));
    if (text.trim() !== "" && Number.isFinite(n) && n >= 1 && n !== value) await onCommit(n);
    setActive(false);
  }

  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      className="h-9 w-14 px-1 text-center"
      value={active ? text : String(value)}
      onFocus={(e) => {
        setText(String(value));
        setActive(true);
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function MemoPanel({ onDone }: { onDone?: () => void }) {
  const items = useCart((s) => s.items);
  const customer = useCart((s) => s.customer);
  const paid = useCart((s) => s.paid);
  const dsr = useCart((s) => s.dsr);
  const setDsr = useCart((s) => s.setDsr);
  const [dsrOpen, setDsrOpen] = useState(false);
  const { data: dsrList } = useSWR<DsrResponse>("/api/dsr", fetcher);
  const { changeQty, setQty, removeItem, setPrice, setPaid, discard, reset } = useCart.getState();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const discountValue = useCart((s) => s.discountValue);
  const discountUnit = useCart((s) => s.discountUnit);
  const setDiscount = useCart((s) => s.setDiscount);
  const subtotal = useMemo(() => round2(cartSubtotal(items)), [items]);
  const discount = discountAmount(subtotal, Number(discountValue), discountUnit);
  const previousDue = customer._id ? customer.dueBalance : 0;
  const grandTotal = round2(subtotal - discount + previousDue);
  const payable = Math.max(grandTotal, 0);
  const received = Math.min(paid ?? 0, payable);
  const balanceAfter = round2(grandTotal - received);

  async function submit(type: "instant" | "due") {
    if (type === "due" && !customer.name.trim()) {
      toast.error("Enter a customer name to save a due sale");
      return;
    }
    setSubmitting(true);
    try {
      const sale = await api<Sale>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer._id,
          customerName: customer.name.trim(),
          customerAddress: customer.address?.trim() ?? "",
          dsr,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice })),
          paid: type === "instant" ? payable : received,
          discount,
          type,
        }),
      });
      toast.success(`${sale.invoiceNo} saved`, {
        description: sale.dueAfter > 0 ? `${sale.customerName} owes ${formatMoney(sale.dueAfter)}` : "Paid in full",
      });
      reset();
      revalidate("/api/");
      onDone?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  /** Goods not handed over yet: save it as an order. No due, no stock taken until it is confirmed in Orders. */
  async function saveOrder() {
    if (!customer.name.trim()) {
      toast.error("Enter the customer's name so you know whose order it is");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ orderNo: string }>("/api/orders/counter", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer._id,
          customerName: customer.name.trim(),
          customerAddress: customer.address?.trim() ?? "",
          dsr,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice })),
        }),
      });
      await discard(); // the items go back on the shelf until the order is confirmed
      toast.success(`${res.orderNo} saved as an order`, {
        description: "Nothing is added to their due. Confirm it in Orders when you hand over the goods.",
        action: { label: "Open Orders", onClick: () => router.push("/orders") },
        duration: 10_000,
      });
      revalidate("/api/");
      onDone?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-lg font-semibold">Memo</h2>
          <p className="text-xs text-muted-foreground">{SHOP_NAME}</p>
        </div>
        {items.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" aria-hidden /> Discard
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this memo?</AlertDialogTitle>
                <AlertDialogDescription>All items go back into stock.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep memo</AlertDialogCancel>
                <AlertDialogAction onClick={() => discard()}>Discard memo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <CustomerPicker />

        <div className="space-y-1.5">
          <Label htmlFor="memo-dsr">Sold by (DSR)</Label>
          <div className="flex gap-2">
            <Select value={dsr || "none"} onValueChange={(v) => setDsr(v === "none" ? "" : v)}>
              <SelectTrigger id="memo-dsr" className="w-full">
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
            <Button variant="outline" size="icon" aria-label="Add or remove DSR" onClick={() => setDsrOpen(true)}>
              <UserPlus className="size-4" />
            </Button>
          </div>
        </div>
        <DsrDialog open={dsrOpen} onOpenChange={setDsrOpen} />

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Tap + on a product to add it to this memo.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const changed = item.unitPrice !== item.defaultPrice;
              return (
                <li key={item.productId} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.code}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-1 -mt-1 size-8"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item.productId)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="size-9" aria-label="Decrease quantity" onClick={() => changeQty(item.productId, -1)}>
                        <Minus className="size-4" />
                      </Button>
                      <QtyInput value={item.qty} label={`Quantity of ${item.name}`} onCommit={(n) => setQty(item.productId, n)} />
                      <Button variant="outline" size="icon" className="size-9" aria-label="Increase quantity" onClick={() => changeQty(item.productId, 1)}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriceInput
                        value={item.unitPrice}
                        label={`Price for ${item.name}`}
                        onCommit={(n) => setPrice(item.productId, n)}
                      />
                      <span className="w-20 text-right font-medium">{formatMoney(item.qty * item.unitPrice)}</span>
                    </div>
                  </div>
                  {changed && <p className="mt-1 text-right text-xs text-warn">List price {formatMoney(item.defaultPrice)}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t bg-card p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatMoney(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount</dt>
              <dd>- {formatMoney(discount)}</dd>
            </div>
          )}
          {previousDue !== 0 && (
            <div className={cn("flex justify-between", previousDue > 0 && "text-warn")}>
              <dt>{previousDue > 0 ? "Previous due" : "Store credit"}</dt>
              <dd>{formatMoney(previousDue)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Grand total</dt>
            <dd>{formatMoney(grandTotal)}</dd>
          </div>
        </dl>

        <DiscountField id="memo-discount" value={discountValue} unit={discountUnit} amount={discount} onChange={setDiscount} />

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="memo-paid">Received now</Label>
            <Input
              id="memo-paid"
              inputMode="decimal"
              placeholder="0"
              value={paid ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPaid(e.target.value === "" || !Number.isFinite(n) || n < 0 ? null : n);
              }}
            />
          </div>
          <Button variant="outline" onClick={() => setPaid(payable)} disabled={payable <= 0}>
            Full amount
          </Button>
        </div>
        <p className="flex justify-between text-sm">
          <span className="text-muted-foreground">Balance if saved as due</span>
          <span className={cn(balanceAfter > 0 && "font-medium text-warn")}>{formatMoney(balanceAfter)}</span>
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" className="h-12" disabled={!items.length || submitting} onClick={() => submit("instant")}>
            Instant sell
          </Button>
          <Button size="lg" variant="outline" className="h-12" disabled={!items.length || submitting} onClick={() => submit("due")}>
            Sold, pay later
          </Button>
          <Button size="lg" variant="secondary" className="col-span-2 h-12" disabled={!items.length || submitting} onClick={saveOrder}>
            Save as order (not delivered yet)
          </Button>
        </div>
      </div>
    </div>
  );
}
