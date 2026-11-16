"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, Search, ShoppingCart, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useMounted } from "@/hooks/use-mounted";
import { fetcher, qs } from "@/lib/fetcher";
import { cn, formatMoney, round2 } from "@/lib/utils";
import { portalCount, portalTotal, usePortalCart } from "@/stores/portal-cart";
import type { PortalProduct, PortalProducts } from "@/types";
import { ProductGallery } from "@/features/inventory/product-gallery";
import { QtyStepper } from "./qty-stepper";

function Availability({ p }: { p: PortalProduct }) {
  if (p.available <= 0) return <span className="font-medium text-destructive">Out of stock</span>;
  if (p.low) return <span className="font-medium text-warn">Only {p.available} left</span>;
  return <span className="text-success">In stock</span>;
}

function ProductCard({ p }: { p: PortalProduct }) {
  const line = usePortalCart((s) => s.items.find((i) => i.productId === p._id));
  const add = usePortalCart((s) => s.add);
  const setQty = usePortalCart((s) => s.setQty);
  const mounted = useMounted();
  const inCart = mounted ? line : undefined;
  const out = p.available <= 0;
  const images = p.images?.length
    ? p.images
    : p.imageUrl
      ? [{ url: p.imageUrl, publicId: "" }]
      : [];

  return (
    <Card className="gap-3 p-3">
      <div>
        <ProductGallery name={p.name} images={images} />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/shop/products/${p._id}`} className="truncate font-medium hover:text-primary">{p.name}</Link>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{p.code}</span>
            <Link href={`/shop/products/${p._id}`} className="underline underline-offset-2">Details</Link>
            {p.group && <Badge variant="outline">{p.group}</Badge>}
          </p>
        </div>
        <p className="shrink-0 font-semibold">{formatMoney(p.price)}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs"><Availability p={p} /></span>
        {inCart ? (
          <QtyStepper value={inCart.qty} max={p.available} label={p.name} onChange={(n) => (n <= 0 ? setQty(p._id, 0) : setQty(p._id, n))} />
        ) : (
          <Button size="sm" disabled={out} aria-label={`Add ${p.name} to cart`} onClick={() => add({ productId: p._id, name: p.name, code: p.code, price: p.price, max: p.available })}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        )}
      </div>
    </Card>
  );
}

/** The shop window: search, groups, and a cart bar. */
export function Catalog() {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);
  const dq = useDebounce(q.trim(), 200);
  const mounted = useMounted();
  const count = usePortalCart((s) => portalCount(s.items));
  const total = usePortalCart((s) => portalTotal(s.items));

  const { data, isLoading } = useSWR<PortalProducts>(`/api/portal/products${qs({ q: dq, group, limit })}`, fetcher);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search products" placeholder="Search a product or code" className="h-11 pl-9 pr-10" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} />
        {q && (
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 size-9 -translate-y-1/2" aria-label="Clear search" onClick={() => setQ("")}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      {data && data.groups.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by group">
          <Button size="sm" variant={group === null ? "default" : "outline"} onClick={() => { setGroup(null); setLimit(60); }}>All</Button>
          {data.groups.map((g) => (
            <Button key={g} size="sm" variant={group === g ? "default" : "outline"} onClick={() => { setGroup(g); setLimit(60); }}>{g}</Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : data?.data.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((p) => <li key={p._id}><ProductCard p={p} /></li>)}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No product matches “{q}”.</p>
      )}

      {data && data.total > data.data.length && (
        <div className="space-y-1 text-center">
          <Button variant="outline" onClick={() => setLimit((n) => n + 60)}>Show more products</Button>
          <p className="text-xs text-muted-foreground">Showing {data.data.length} of {data.total}. You can also search by name.</p>
        </div>
      )}

      {mounted && count > 0 && (
        <Link href="/shop/cart" className={cn("fixed inset-x-4 bottom-20 z-30 flex items-center justify-between rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-lg", "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:gap-6")}>
          <span className="flex items-center gap-2 font-medium"><ShoppingCart className="size-5" aria-hidden /> View cart · {count}</span>
          <span className="font-semibold">{formatMoney(round2(total))}</span>
        </Link>
      )}
    </div>
  );
}
