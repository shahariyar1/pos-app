"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/stores/cart-store";

type AddableProduct = {
  _id: string;
  name: string;
  code: string;
  salePrice: number;
};

export function AddToMemoButton({
  product,
  stock,
}: {
  product: AddableProduct;
  stock: number;
}) {
  const addProduct = useCart((state) => state.addProduct);
  const [remainingStock, setRemainingStock] = useState(stock);
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (adding || remainingStock <= 0) return;

    setAdding(true);
    try {
      const added = await addProduct(product);
      if (added) {
        setRemainingStock((current) => Math.max(0, current - 1));
        toast.success(`${product.name} added to memo`);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <Button
      type="button"
      className="h-11 w-full"
      onClick={handleAdd}
      disabled={adding || remainingStock <= 0}
      aria-label={`Add ${product.name} to memo`}
    >
      {adding ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Plus className="mr-2 size-5" />
      )}
      {remainingStock > 0 ? "Add to Memo" : "Out of stock"}
    </Button>
  );
}
