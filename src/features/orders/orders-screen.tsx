"use client";

import { useState } from "react";
import useSWR from "swr";
import { Phone } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage, fetcher, qs, revalidate } from "@/lib/fetcher";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import type { OrderStatus, OwnerOrder } from "@/types";
import { AccountsPanel } from "./accounts-panel";
import { ConfirmOrderDialog } from "./confirm-order-dialog";

const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-warn-soft text-warn" },
  confirmed: { label: "Confirmed", cls: "bg-success-soft text-success" },
  rejected: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled by customer", cls: "bg-muted text-muted-foreground" },
};

const FILTERS = [
  { value: "pending", label: "Waiting" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
] as const;

function OrdersList() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("pending");
  const [confirming, setConfirming] = useState<OwnerOrder | null>(null);
  const [rejecting, setRejecting] = useState<OwnerOrder | null>(null);
  const [reason, setReason] = useState("");
  const { data, isLoading } = useSWR<{ data: OwnerOrder[] }>(`/api/orders${qs({ status: filter === "all" ? undefined : filter })}`, fetcher, { refreshInterval: 20_000 });

  async function reject() {
    if (!rejecting) return;
    try {
      await api(`/api/orders/${rejecting._id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
      toast.success(`${rejecting.orderNo} rejected`);
      revalidate("/api/");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRejecting(null);
      setReason("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? "default" : "outline"} onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : data?.data.length ? (
        <ul className="space-y-3">
          {data.data.map((o) => (
            <li key={o._id} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {o.shopName} <span className="font-normal text-muted-foreground">· {o.orderNo}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{o.address}</p>
                </div>
                <Badge className={cn("border-transparent font-medium", STATUS[o.status].cls)}>{STATUS[o.status].label}</Badge>
              </div>

              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {o.phone ? (
                  <a href={`tel:${o.phone}`} className="flex items-center gap-1 font-medium text-primary underline">
                    <Phone className="size-3.5" aria-hidden /> {o.phone}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">No phone</span>
                )}
                {o.source === "counter" && <Badge variant="outline">Saved at counter</Badge>}
                {o.dsr && <span className="text-xs text-muted-foreground">DSR {o.dsr}</span>}
                <span className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                {o.due !== null && o.due !== 0 && (
                  <span className={cn("text-xs font-medium", o.due > 0 ? "text-warn" : "text-success")}>
                    {o.due > 0 ? `Already owes ${formatMoney(o.due)}` : `Has credit ${formatMoney(-o.due)}`}
                  </span>
                )}
              </p>

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
              {o.note && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">Note: {o.note}</p>}
              {o.status === "confirmed" && o.invoiceNo && <p className="text-sm text-success">Memo {o.invoiceNo} created. Find it on the Dashboard.</p>}
              {o.status === "rejected" && o.ownerNote && <p className="text-sm text-muted-foreground">Reason: {o.ownerNote}</p>}

              {o.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setConfirming(o)}>Review and confirm</Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => setRejecting(o)}>
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">{filter === "pending" ? "No orders are waiting." : "Nothing here."}</p>
      )}

      <ConfirmOrderDialog key={`c-${confirming?._id ?? "x"}`} order={confirming} onClose={() => setConfirming(null)} />

      <AlertDialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejecting?.orderNo}?</AlertDialogTitle>
            <AlertDialogDescription>{rejecting?.shopName} will see that the order was not accepted. You can tell them why.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input aria-label="Reason (optional)" placeholder="Reason, e.g. out of stock (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction onClick={reject}>Reject order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Orders from customers, and the customers waiting to be approved. */
export function OrdersScreen() {
  const [tab, setTab] = useState<"orders" | "signups">("orders");
  const { data: badges } = useSWR<{ orders: number; registrations: number }>("/api/owner/badges", fetcher, { refreshInterval: 20_000 });

  const count = (n?: number) =>
    n ? <span className="ml-1 rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">{n}</span> : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="flex gap-1 rounded-lg border bg-card p-1 sm:w-fit" role="tablist" aria-label="Orders or sign-ups">
        <Button role="tab" aria-selected={tab === "orders"} className="flex-1 sm:flex-none" size="sm" variant={tab === "orders" ? "default" : "ghost"} onClick={() => setTab("orders")}>
          Customer orders {count(badges?.orders)}
        </Button>
        <Button role="tab" aria-selected={tab === "signups"} className="flex-1 sm:flex-none" size="sm" variant={tab === "signups" ? "default" : "ghost"} onClick={() => setTab("signups")}>
          New customers {count(badges?.registrations)}
        </Button>
      </div>
      {tab === "orders" ? <OrdersList /> : <AccountsPanel />}
    </div>
  );
}
