"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductGallery } from "@/features/inventory/product-gallery";
import { QtyStepper } from "@/features/portal/qty-stepper";
import { fetcher, qs } from "@/lib/fetcher";
import { formatMoney } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import { usePortalCart } from "@/stores/portal-cart";
import type { PortalProducts } from "@/types";

export function CustomerProductDetails({ id }: { id: string }) {
  const { data, isLoading } = useSWR<PortalProducts>(`/api/portal/products${qs({ ids: id })}`, fetcher);
  const mounted = useMounted();
  const product = data?.data[0];
  const line = usePortalCart((s) => s.items.find((item) => item.productId === id));
  const add = usePortalCart((s) => s.add);
  const setQty = usePortalCart((s) => s.setQty);

  if (isLoading) {
    return <div className="grid gap-5 md:grid-cols-2"><Skeleton className="aspect-square rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>;
  }

  if (!product) {
    return <div className="space-y-4"><Link href="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Back to shop</Link><p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Product not found or no longer available.</p></div>;
  }

  const images = product.images?.length ? product.images : product.imageUrl ? [{ url: product.imageUrl, publicId: "" }] : [];

  return (
    <div className="space-y-5">
      <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to shop</Link>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-3">
          <ProductGallery name={product.name} images={images} />
        </Card>
        <Card className="space-y-4 p-5">
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Code: {product.code}</p>
            {product.group && <Badge className="mt-2" variant="outline">{product.group}</Badge>}
          </div>
          <p className="text-3xl font-bold">{formatMoney(product.price)}</p>
          <Badge variant={product.available > 0 ? "secondary" : "destructive"}>
            {product.available > 0 ? `${product.available} in stock` : "Out of stock"}
          </Badge>
          {mounted && (line ? (
            <QtyStepper value={line.qty} max={product.available} label={product.name} onChange={(n) => setQty(id, n)} />
          ) : (
            <Button className="w-full sm:w-auto" disabled={product.available <= 0} onClick={() => add({ productId: id, name: product.name, code: product.code, price: product.price, max: product.available })}>
              <Plus className="size-4" aria-hidden /> Add to cart
            </Button>
          ))}
          <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
            <div><p className="text-muted-foreground">Product code</p><p className="font-medium">{product.code}</p></div>
            <div><p className="text-muted-foreground">Category</p><p className="font-medium">{product.group || "—"}</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
