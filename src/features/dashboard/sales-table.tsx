"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Eye, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
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
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage, fetcher, qs, revalidate } from "@/lib/fetcher";
import { printSale } from "@/lib/print-memo";
import { formatDateTime, formatMoney } from "@/lib/utils";
import type { Sale, SalesResponse } from "@/types";
import { EditSaleDialog } from "./edit-sale-dialog";

type Filters = { from: string; to: string; status: string; q: string; dsr: string | null };

const profitOf = (s: Sale) => s.items.reduce((sum, i) => sum + (i.unitPrice - (i.costPrice ?? 0)) * i.qty, 0) - (s.discount ?? 0);

export function SalesTable({ filters }: { filters: Filters }) {
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [paying, setPaying] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const key = `/api/sales${qs({
    from: filters.from,
    to: filters.to,
    status: filters.status === "all" ? undefined : filters.status,
    q: filters.q,
    dsr: filters.dsr,
  })}`;
  const { data, isLoading } = useSWR<SalesResponse>(key, fetcher);
  const unlocked = data?.unlocked ?? false;

  const columns = useMemo<ColumnDef<Sale>[]>(() => {
    const cols: ColumnDef<Sale>[] = [
      { accessorKey: "createdAt", header: "Time", cell: ({ row }) => formatDateTime(row.original.createdAt) },
      { accessorKey: "invoiceNo", header: "Invoice", cell: ({ row }) => <span className="font-medium">{row.original.invoiceNo}</span> },
      { accessorKey: "customerName", header: "Customer" },
      { accessorKey: "subtotal", header: "Sale", cell: ({ row }) => formatMoney(row.original.subtotal - (row.original.discount ?? 0)) },
      {
        accessorKey: "previousDue",
        header: "Prev. due",
        cell: ({ row }) => (row.original.previousDue ? formatMoney(row.original.previousDue) : <span className="text-muted-foreground">None</span>),
      },
      { accessorKey: "paid", header: "Paid", cell: ({ row }) => formatMoney(row.original.paid) },
      {
        accessorKey: "dueAfter",
        header: "Due after",
        cell: ({ row }) => <span className={row.original.dueAfter > 0 ? "font-medium text-warn" : ""}>{formatMoney(row.original.dueAfter)}</span>,
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ];
    if (unlocked) {
      cols.push({ id: "profit", header: "Profit", accessorFn: profitOf, cell: ({ row }) => formatMoney(profitOf(row.original)) });
    }
    cols.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`View ${row.original.invoiceNo}`} onClick={() => setViewing(row.original)}>
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Add products to ${row.original.invoiceNo}`} onClick={() => setEditing(row.original)}>
            <Pencil className="size-4" />
          </Button>
          {row.original.dueAfter > 0 && (
            <Button variant="ghost" size="icon" aria-label={`Mark ${row.original.invoiceNo} as paid`} title="Mark as paid" onClick={() => setPaying(row.original)}>
              <Check className="size-4 text-success" />
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label={`Print ${row.original.invoiceNo}`} onClick={() => printSale(row.original)}>
            <Printer className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.invoiceNo}`} onClick={() => setDeleting(row.original)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    });
    return cols;
  }, [unlocked]);

  async function confirmPay() {
    if (!paying) return;
    try {
      await api(`/api/sales/${paying._id}/pay`, { method: "POST" });
      toast.success(`${paying.invoiceNo} marked as paid`);
      revalidate("/api/");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPaying(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/sales/${deleting._id}`, { method: "DELETE" });
      toast.success(`${deleting.invoiceNo} deleted`);
      revalidate("/api/");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No sales in this range." />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{viewing?.invoiceNo}</DialogTitle>
            <DialogDescription>
              {viewing?.customerName} · {viewing && formatDateTime(viewing.createdAt)}
              {viewing?.customerAddress ? ` · ${viewing.customerAddress}` : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewing.items.map((i, idx) => (
                    <TableRow key={`${i.product}-${idx}`}>
                      <TableCell>
                        {i.name}
                        <span className="block text-xs text-muted-foreground">{i.code}</span>
                      </TableCell>
                      <TableCell className="text-right">{i.qty}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(i.unitPrice)}
                        {i.unitPrice !== i.defaultPrice && <span className="block text-xs text-warn">List {formatMoney(i.defaultPrice)}</span>}
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(i.unitPrice * i.qty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <dl className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(viewing.subtotal)}</dd></div>
                {!!viewing.discount && <div className="flex justify-between text-success"><dt>Discount</dt><dd>- {formatMoney(viewing.discount)}</dd></div>}
                {!!viewing.returnTotal && <div className="flex justify-between"><dt>Returned items</dt><dd>- {formatMoney(viewing.returnTotal)}</dd></div>}
                <div className="flex justify-between"><dt>Previous due</dt><dd>{formatMoney(viewing.previousDue)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Grand total</dt><dd>{formatMoney(viewing.grandTotal)}</dd></div>
                <div className="flex justify-between"><dt>Paid</dt><dd>{formatMoney(viewing.paid)}</dd></div>
                <div className="flex justify-between font-medium text-warn"><dt>Due after</dt><dd>{formatMoney(viewing.dueAfter)}</dd></div>
              </dl>
              {!!viewing.history?.length && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="mb-1 font-medium">History</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {viewing.history.map((h, i) => (
                      <li key={i}>
                        <span className="text-xs">{formatDateTime(h.at)}</span> · {h.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditing(viewing); setViewing(null); }}>
                  <Pencil className="size-4" aria-hidden /> Edit memo
                </Button>
                <Button onClick={() => printSale(viewing)}>
                  <Printer className="size-4" aria-hidden /> Print memo
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditSaleDialog key={editing?._id ?? "closed"} sale={editing} onClose={() => setEditing(null)} />

      <AlertDialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {paying?.invoiceNo} as paid?</AlertDialogTitle>
            <AlertDialogDescription>
              {paying?.customerName} paid the remaining {paying && formatMoney(paying.dueAfter)}. The due is cleared and their balance is updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPay}>Yes, it is paid</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.invoiceNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              The items go back into stock, {deleting?.customerName}'s balance is corrected, and any returns logged on this memo are removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep memo</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete memo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
