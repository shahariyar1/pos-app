"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

function Availability({ p }: { p: PortalProduct }) {
  if (p.available <= 0) return <span className="font-medium text-destructive">Out of stock</span>;
  if (p.low) return <span className="font-medium text-warn">Only {p.available} left</span>;
  return <span className="text-success">In stock</span>;
}

function ProductCard({ p }: { p: PortalProduct }) {
  const router = useRouter();
  const add = usePortalCart((s) => s.add);
  const images = p.images?.length
    ? p.images
    : p.imageUrl
      ? [{ url: p.imageUrl, publicId: "" }]
      : [];
  const out = p.available <= 0;

  return (
    <Card
      className="flex h-full cursor-pointer flex-col gap-3 overflow-hidden p-3 transition-colors hover:border-primary/50 hover:shadow-md"
      onClick={() => router.push(`/shop/products/${p._id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/shop/products/${p._id}`);
        }
      }}
      aria-label={`View ${p.name} product details`}
    >
      {images.length > 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {images.slice(0, 2).map((image, index) => (
            <img key={`${image.publicId}-${index}`} src={image.url} alt={`${p.name} ${index + 1}`} className="aspect-square w-full rounded-lg bg-muted object-contain" />
          ))}
        </div>
      ) : images.length === 1 ? (
        <img src={images[0].url} alt={p.name} className="aspect-square w-full rounded-lg bg-muted object-contain" />
      ) : (
        <div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">No image</div>
      )}
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 min-h-10 font-medium leading-5">{p.name}</p>
        <p className="text-xs text-muted-foreground">{p.code}</p>
        {p.group && <Badge variant="outline">{p.group}</Badge>}
        <p className="pt-1 text-base font-bold">{formatMoney(p.price)}</p>
        <p className="text-xs"><Availability p={p} /></p>
      </div>
      <div className="mt-auto flex justify-end">
        <Button
          size="icon"
          className="size-10 shrink-0 rounded-full"
          disabled={out}
          aria-label={`Add ${p.name} to cart`}
          onClick={(event) => {
            event.stopPropagation();
            add({ productId: p._id, name: p.name, code: p.code, price: p.price, max: p.available });
          }}
        >
          <Plus className="size-5" />
        </Button>
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
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : data?.data.length ? (
        <ul className="grid grid-cols-2 gap-3">
          {data.data.map((p) => <li key={p._id} className="min-w-0"><ProductCard p={p} /></li>)}
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
