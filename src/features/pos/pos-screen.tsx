"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Receipt, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useMounted } from "@/hooks/use-mounted";
import { fetcher, qs } from "@/lib/fetcher";
import { cn, formatMoney, round2 } from "@/lib/utils";
import { cartCount, cartSubtotal, useCart } from "@/stores/cart-store";
import type { Product, ProductsResponse } from "@/types";
import { MemoPanel } from "./memo-panel";

function ProductCard({ product }: { product: Product }) {
  const addProduct = useCart((s) => s.addProduct);
  const out = product.stock <= 0;
  const low = !out && product.stock <= product.lowStockThreshold;
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{product.name}</p>
        <p className="truncate text-sm text-muted-foreground">{product.code}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <Badge variant="secondary">{product.location || "No location"}</Badge>
          <span className={cn(out && "font-medium text-destructive", low && "font-medium text-warn")}>
            {out ? "Out of stock" : `${product.stock} in stock`}
          </span>
        </div>
      </div>
      <p className="font-semibold">{formatMoney(product.salePrice)}</p>
      <Button
        size="icon"
        className="size-11 shrink-0 rounded-full"
        disabled={out}
        aria-label={`Add ${product.name} ${product.code} to memo`}
        onClick={() => addProduct(product)}
      >
        <Plus className="size-5" />
      </Button>
    </Card>
  );
}

export function PosScreen({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [group, setGroup] = useState<string | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const debounced = useDebounce(q.trim(), 150);
  const mounted = useMounted();
  const items = useCart((s) => s.items);
  const addProduct = useCart((s) => s.addProduct);

  const { data, isLoading } = useSWR<ProductsResponse>(`/api/products${qs({ q: debounced, group, limit: 60 })}`, fetcher);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label="Products" className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            autoFocus
            aria-label="Search products"
            placeholder="Search by code or name, e.g. Y20"
            className="h-11 bg-card pl-9 pr-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds the top result: fast for scanner or keyboard use
              if (e.key === "Enter" && data?.data[0]) addProduct(data.data[0]);
            }}
          />
          {q && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 size-9 -translate-y-1/2" aria-label="Clear search" onClick={() => setQ("")}>
              <X className="size-4" />
            </Button>
          )}
        </div>

        {data && data.groups.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by group">
            <Button size="sm" variant={group === null ? "default" : "outline"} onClick={() => setGroup(null)}>
              All
            </Button>
            {data.groups.map((g) => (
              <Button key={g} size="sm" variant={group === g ? "default" : "outline"} onClick={() => setGroup(g)}>
                {g}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : data?.data.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.data.map((p) => (
              <li key={p._id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            No product matches "{q}". Check the spelling or add it in Inventory.
          </p>
        )}
      </section>

      {/* Desktop: memo stays visible beside the products */}
      <aside aria-label="Memo" className="hidden lg:block">
        <div className="sticky top-20 h-[calc(100dvh-6.5rem)] overflow-hidden rounded-xl border bg-card">
          {mounted ? <MemoPanel /> : <Skeleton className="h-full" />}
        </div>
      </aside>

      {/* Tablet and phone: memo slides in from a floating button */}
      {mounted && items.length > 0 && (
        <Button
          className="fixed bottom-20 right-4 z-30 h-12 rounded-full px-5 shadow-lg sm:bottom-6 lg:hidden"
          onClick={() => setMemoOpen(true)}
        >
          <Receipt className="size-5" aria-hidden />
          Memo · {cartCount(items)} · {formatMoney(round2(cartSubtotal(items)))}
        </Button>
      )}
      <Sheet open={memoOpen} onOpenChange={setMemoOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Memo</SheetTitle>
            <SheetDescription>Items, customer and payment for the current sale</SheetDescription>
          </SheetHeader>
          {mounted && <MemoPanel onDone={() => setMemoOpen(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
