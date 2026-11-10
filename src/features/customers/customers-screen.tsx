"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { HandCoins, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage, fetcher, qs, revalidate } from "@/lib/fetcher";
import { formatMoney } from "@/lib/utils";
import type { Customer, CustomersResponse } from "@/types";
import { CustomerFormDialog, PaymentDialog } from "./customer-dialogs";

export function CustomersScreen() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [paying, setPaying] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const debounced = useDebounce(q.trim(), 200);

  const { data, isLoading } = useSWR<CustomersResponse>(
    `/api/customers${qs({ q: debounced, hasDue: filter === "due" ? "true" : undefined })}`,
    fetcher,
  );

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: "address", header: "Address", cell: ({ row }) => row.original.address || <span className="text-muted-foreground">None</span> },
      { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone || <span className="text-muted-foreground">None</span> },
      {
        accessorKey: "dueBalance",
        header: "Due",
        cell: ({ row }) => {
          const d = row.original.dueBalance;
          if (d > 0) return <span className="font-medium text-warn">{formatMoney(d)}</span>;
          if (d < 0) return <span className="text-success">{formatMoney(-d)} credit</span>;
          return <span className="text-muted-foreground">Clear</span>;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={row.original.dueBalance <= 0} onClick={() => setPaying(row.original)}>
              <HandCoins className="size-4" aria-hidden /> Collect payment
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Edit ${row.original.name}`} onClick={() => { setEditing(row.original); setFormOpen(true); }}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Delete ${row.original.name}`} onClick={() => setDeleting(row.original)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/customers/${deleting._id}?force=true`, { method: "DELETE" });
      toast.success(`${deleting.name} deleted`);
      revalidate("/api/customers");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" aria-hidden /> Add customer
        </Button>
      </div>

      <Card className="max-w-sm">
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">Total owed to you</p>
          <p className="text-2xl font-semibold text-warn">{formatMoney(data?.totalDue ?? 0)}</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search customers" placeholder="Search by name or phone" className="bg-card pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger aria-label="Filter customers" className="w-44 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="due">Owing money</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No customers yet. They are added automatically when you save a memo." />

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editing} />
      <PaymentDialog customer={paying} onClose={() => setPaying(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.dueBalance > 0
                ? `${deleting.name} still owes ${formatMoney(deleting.dueBalance)}. Deleting removes that balance, so you will no longer see it. `
                : ""}
              Past memos and returns keep the name for your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep customer</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete customer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
