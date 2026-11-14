"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMounted } from "@/hooks/use-mounted";
import { api, errorMessage, fetcher, qs, revalidate } from "@/lib/fetcher";
import { normalizePhone } from "@/lib/phone";
import { cn, formatMoney, round2 } from "@/lib/utils";
import { usePortalCart } from "@/stores/portal-cart";
import type { PortalMe, PortalProducts } from "@/types";
import { QtyStepper } from "./qty-stepper";

/** Review the cart and send the order to the shop. The shop confirms it into a memo. */
export function CartScreen() {
  const router = useRouter();
  const mounted = useMounted();
  const items = usePortalCart((s) => s.items);
  const note = usePortalCart((s) => s.note);
  const { setQty, remove, setNote, clear } = usePortalCart.getState();
  const [phone, setPhone] = useState<string | null>(null); // null = use the saved number
  const [busy, setBusy] = useState(false);

  const { data: me } = useSWR<PortalMe>("/api/portal/me", fetcher);
  // today's price and stock for exactly the items in the cart (not the whole catalog)
  const idsKey = items.map((i) => i.productId).join(",");
  const { data: catalog } = useSWR<PortalProducts>(idsKey ? `/api/portal/products${qs({ ids: idsKey })}` : null, fetcher);

  if (!mounted) return null;

  // Always show today's price and stock, even if the cart was filled days ago
  const live = new Map((catalog?.data ?? []).map((p) => [p._id, p]));
  const lines = items.map((i) => {
    const p = live.get(i.productId);
    const known = !!catalog;
    return { ...i, price: p?.price ?? i.price, max: p ? p.available : i.max, gone: known && (!p || p.available <= 0), short: known && !!p && p.available > 0 && i.qty > p.available };
  });
  const total = round2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const blocked = lines.some((l) => l.gone || l.short);

  const typed = phone ?? me?.phone ?? "";
  const phoneOk = normalizePhone(typed) !== null;

  async function place() {
    setBusy(true);
    try {
      const res = await api<{ orderNo: string }>("/api/portal/orders", {
        method: "POST",
        body: JSON.stringify({ items: items.map((i) => ({ productId: i.productId, qty: i.qty })), note, phone: typed }),
      });
      clear();
      revalidate("/api/portal");
      toast.success(`Order ${res.orderNo} sent`, { description: "The shop will confirm it soon." });
      router.push("/shop/orders");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button onClick={() => router.push("/shop")}>Go to the shop</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Your cart</h1>

      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.productId} className={cn("rounded-xl border bg-card p-3", (l.gone || l.short) && "border-destructive/50")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {l.code} · {formatMoney(l.price)} each
                </p>
              </div>
              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 size-8" aria-label={`Remove ${l.name}`} onClick={() => remove(l.productId)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <QtyStepper value={l.qty} max={Math.max(l.max, 1)} label={l.name} onChange={(n) => setQty(l.productId, n)} />
              <span className="font-semibold">{formatMoney(l.qty * l.price)}</span>
            </div>
            {l.gone && <p className="mt-2 text-sm text-destructive">No longer available. Please remove it.</p>}
            {l.short && <p className="mt-2 text-sm text-destructive">Only {l.max} in stock. Lower the quantity.</p>}
          </li>
        ))}
      </ul>

      <Card>
        <CardContent className="space-y-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-base font-semibold">
              <dt>Order total</dt>
              <dd>{formatMoney(total)}</dd>
            </div>
            {me?.due !== null && me?.due !== undefined && me.due !== 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <dt>{me.due > 0 ? "Your current due" : "Your credit"}</dt>
                  <dd className={me.due > 0 ? "text-warn" : "text-success"}>{formatMoney(Math.abs(me.due))}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Total with your {me.due > 0 ? "due" : "credit"}</dt>
                  <dd>{formatMoney(round2(total + me.due))}</dd>
                </div>
              </>
            )}
          </dl>

          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Phone number (needed for orders)</Label>
            <Input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={typed} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!typed && !phoneOk} />
            {typed && !phoneOk ? (
              <p role="alert" className="text-sm text-destructive">Enter a mobile number like 01XXXXXXXXX</p>
            ) : (
              <p className="text-xs text-muted-foreground">So the shop can call you about this order. Never used for spam.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-note">Note for the shop (optional)</Label>
            <Textarea id="c-note" rows={2} placeholder="Delivery time, colour, anything the shop should know" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button className="h-12 w-full text-base" disabled={busy || blocked || !phoneOk} onClick={place}>
            {busy ? "Sending…" : "Send order to the shop"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Nothing is charged now. The shop checks the order and confirms it.</p>
        </CardContent>
      </Card>
    </div>
  );
}
