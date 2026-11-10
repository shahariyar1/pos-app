"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage, fetcher, revalidate } from "@/lib/fetcher";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import { usePortalCart } from "@/stores/portal-cart";
import type { OrderStatus, PortalOrder } from "@/types";

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "Waiting for the shop", cls: "bg-warn-soft text-warn" },
  confirmed: { label: "Confirmed", cls: "bg-success-soft text-success" },
  rejected: { label: "Not accepted", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

export function MyOrders() {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<PortalOrder | null>(null);
  // status changes show up on their own while the page is open
  const { data, isLoading } = useSWR<{ data: PortalOrder[] }>("/api/portal/orders", fetcher, { refreshInterval: 15_000 });

  function orderAgain(o: PortalOrder) {
    const { add } = usePortalCart.getState();
    for (const i of o.items) add({ productId: i.product, name: i.name, code: i.code, price: i.unitPrice, max: 999 }, i.qty);
    router.push("/shop/cart"); // the cart shows today's prices and stock
  }

  async function confirmCancel() {
    if (!cancelling) return;
    try {
      await api(`/api/portal/orders/${cancelling._id}/cancel`, { method: "POST" });
      toast.success(`${cancelling.orderNo} cancelled`);
      revalidate("/api/portal/orders");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">My orders</h1>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : data?.data.length ? (
        <ul className="space-y-3">
          {data.data.map((o) => (
            <li key={o._id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{o.orderNo}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                </div>
                <Badge className={cn("border-transparent font-medium", STATUS[o.status].cls)}>{STATUS[o.status].label}</Badge>
              </div>

              <ul className="space-y-1 text-sm">
                {o.items.map((i) => (
                  <li key={i.product} className="flex justify-between gap-2">
                    <span>
                      {i.name} <span className="text-muted-foreground">× {i.qty}</span>
                    </span>
                    <span>{formatMoney(i.qty * i.unitPrice)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatMoney(o.subtotal)}</span>
              </p>

              {o.note && <p className="text-sm text-muted-foreground">Your note: {o.note}</p>}
              {o.status === "confirmed" && o.invoiceNo && (
                <p className="text-sm text-success">Confirmed as memo {o.invoiceNo}. You can see it in My account.</p>
              )}
              {o.status === "rejected" && <p className="text-sm text-destructive">{o.ownerNote ? `The shop says: ${o.ownerNote}` : "The shop could not accept this order. Please call them."}</p>}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => orderAgain(o)}>
                  Order again
                </Button>
                {o.status === "pending" && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(o)}>
                    Cancel order
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3 py-16 text-center">
          <p className="text-muted-foreground">You have not ordered yet.</p>
          <Button onClick={() => router.push("/shop")}>Go to the shop</Button>
        </div>
      )}

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelling?.orderNo}?</AlertDialogTitle>
            <AlertDialogDescription>The shop has not confirmed it yet, so nothing will be charged.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Cancel order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
