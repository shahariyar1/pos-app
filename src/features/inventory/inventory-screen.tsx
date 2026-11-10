"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { FileUp, PackagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage, fetcher, qs, revalidate } from "@/lib/fetcher";
import { cn, formatMoney } from "@/lib/utils";
import { useCart } from "@/stores/cart-store";
import type { Product, ProductsResponse } from "@/types";
import { ImportFileDialog } from "./import-file-dialog";
import { ProductFormDialog } from "./product-form-dialog";
import { ReceiveStockDialog } from "./receive-stock-dialog";

export function InventoryScreen({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [location, setLocation] = useState("all");
  const [stock, setStock] = useState("all");
  const [group, setGroup] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [receiving, setReceiving] = useState<Product | null>(null);
  const addProduct = useCart((s) => s.addProduct);
  const debounced = useDebounce(q.trim(), 200);

  const key = `/api/products${qs({
    q: debounced,
    location: location === "all" ? undefined : location,
    stock: stock === "all" ? undefined : stock,
    group: group === "all" ? undefined : group,
    limit: 2000,
  })}`;
  const { data, isLoading } = useSWR<ProductsResponse>(key, fetcher);
  const unlocked = data?.unlocked ?? false;

  const columns = useMemo<ColumnDef<Product>[]>(() => {
    const cols: ColumnDef<Product>[] = [
      {
        id: "add",
        header: () => <span className="sr-only">Add to memo</span>,
        cell: ({ row }) => (
          <Button
            size="icon"
            className="size-10 rounded-full"
            disabled={row.original.stock <= 0}
            aria-label={`Add ${row.original.name} ${row.original.code} to memo`}
            onClick={() => addProduct(row.original)}
          >
            <Plus className="size-5" />
          </Button>
        ),
      },
      { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "group",
        header: "Group",
        cell: ({ row }) => (row.original.group ? <Badge variant="outline">{row.original.group}</Badge> : <span className="text-muted-foreground">None</span>),
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => (row.original.location ? <Badge variant="secondary">{row.original.location}</Badge> : <span className="text-muted-foreground">None</span>),
      },
    ];
    if (unlocked) {
      cols.push({ accessorKey: "costPrice", header: "Cost", cell: ({ row }) => formatMoney(row.original.costPrice ?? 0) });
    }
    cols.push(
      { accessorKey: "salePrice", header: "Sale price", cell: ({ row }) => formatMoney(row.original.salePrice) },
      {
        accessorKey: "stock",
        header: "Stock",
        cell: ({ row }) => {
          const { stock: s, lowStockThreshold: t } = row.original;
          return (
            <span className={cn("font-medium", s === 0 && "text-destructive", s > 0 && s <= t && "text-warn")}>
              {s}
              {s === 0 ? " · out" : s <= t ? " · low" : ""}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label={`Receive stock for ${row.original.name}`} title="Receive stock" onClick={() => setReceiving(row.original)}>
              <PackagePlus className="size-4" />
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
    );
    return cols;
  }, [unlocked, addProduct]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/products/${deleting._id}`, { method: "DELETE" });
      toast.success(`${deleting.name} removed`);
      revalidate("/api/products");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="size-4" aria-hidden /> Import from file
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="size-4" aria-hidden /> Add product
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search inventory" placeholder="Search by code, name or location" className="bg-card pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger aria-label="Filter by group" className="w-40 bg-card">
            <SelectValue placeholder="Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {data?.groups.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger aria-label="Filter by location" className="w-40 bg-card">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {data?.locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stock} onValueChange={setStock}>
          <SelectTrigger aria-label="Filter by stock level" className="w-40 bg-card">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock levels</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} emptyMessage="No products match. Clear the filters or add a product." />

      <ImportFileDialog key={String(importOpen)} open={importOpen} onOpenChange={setImportOpen} />
      <ReceiveStockDialog key={receiving?._id ?? "none"} product={receiving} onClose={() => setReceiving(null)} />
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} canEditCost={unlocked} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>It disappears from search and the memo. Past sales and returns keep their history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep product</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove product</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
