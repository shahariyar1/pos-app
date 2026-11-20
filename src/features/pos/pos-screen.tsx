"use client";

import { useEffect, useRef, useState } from "react";
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
import { useRouter } from "next/navigation";

function buildSellReturnUrl(query: string, group: string | null) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (group) params.set("g", group);
  const search = params.toString();
  return search ? `/pos?${search}` : "/pos";
}

function ProductCard({ product, returnTo }: { product: Product; returnTo: string }) {
  const router = useRouter();
  const addProduct = useCart((s) => s.addProduct);
  const out = product.stock <= 0;
  const low = !out && product.stock <= product.lowStockThreshold;
  const detailUrl = `/products/${product._id}?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <Card
      className="flex h-full cursor-pointer flex-col gap-2 overflow-hidden p-2 transition-shadow hover:shadow-md"
      onPointerEnter={() => router.prefetch(detailUrl)}
      onClick={() => router.push(detailUrl)}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="aspect-square w-full rounded-lg bg-muted object-contain"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          No Image
        </div>
      )}

      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 min-h-10 text-sm font-medium">
          {product.name}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          {product.code}
        </p>

        {product.location && (
          <p className="text-xs font-medium text-primary">
            Location: {product.location}
          </p>
        )}

        {product.matchedCompatibleModels && product.matchedCompatibleModels.length > 0 && (
          <p className="line-clamp-2 text-xs font-medium text-primary">
            Compatible: {product.matchedCompatibleModels.join(", ")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">
            {out ? "Out of stock" : `${product.stock} in stock`}
          </Badge>

          {low && (
            <Badge variant="outline" className="text-warn">
              Low stock
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <p className="text-base font-bold">
          {formatMoney(product.salePrice)}
        </p>

        <Button
          size="icon"
          className="size-10 shrink-0 rounded-full"
          disabled={out}
          aria-label={`Add ${product.name} ${product.code} to memo`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            addProduct(product);
          }}
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </Card>
  );
}

export function PosScreen({ initialQuery, initialGroup }: { initialQuery: string; initialGroup?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [group, setGroup] = useState<string | null>(initialGroup ?? null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [limit, setLimit] = useState(60);
  const [scrollToIndex, setScrollToIndex] = useState<number | null>(null);
  const newProductsRef = useRef<HTMLLIElement | null>(null);
  const debounced = useDebounce(q.trim(), 150);
  const mounted = useMounted();
  const items = useCart((s) => s.items);
  const addProduct = useCart((s) => s.addProduct);

  const { data, isLoading, isValidating } = useSWR<ProductsResponse>(`/api/products${qs({ q: debounced, group, limit })}`, fetcher);

  useEffect(() => {
    setLimit(60);
    setScrollToIndex(null);
  }, [debounced, group]);

  useEffect(() => {
    if (scrollToIndex !== null && (data?.data.length ?? 0) > scrollToIndex) {
      newProductsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToIndex(null);
    }
  }, [data?.data.length, scrollToIndex]);

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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((p, index) => (
              <li key={p._id} ref={index === scrollToIndex ? newProductsRef : undefined}>
                <ProductCard product={p} returnTo={buildSellReturnUrl(q, group)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            No product matches "{q}". Check the spelling or add it in Inventory.
          </p>
        )}

        {data && data.total > data.data.length && limit < 2000 && (
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-xs text-muted-foreground">
              Showing {data.data.length} of {data.total} products
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setScrollToIndex(data.data.length);
                setLimit((current) => Math.min(current + 60, 2000));
              }}
              disabled={isValidating}
            >
              {isValidating ? "Loading..." : "Load more products"}
            </Button>
          </div>
        )}
        {data && data.total > data.data.length && limit >= 2000 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing the first 2,000 products. Search to find other products.
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
