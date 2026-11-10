import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import { api, errorMessage, revalidate } from "@/lib/fetcher";
import type { DiscountUnit } from "@/lib/discount";
import type { Product } from "@/types";

export type CartItem = {
  productId: string;
  name: string;
  code: string;
  qty: number;
  unitPrice: number; // editable on the memo
  defaultPrice: number;
};
export type CartCustomer = { _id?: string; name: string; dueBalance: number; address?: string };

const EMPTY_CUSTOMER: CartCustomer = { name: "", dueBalance: 0 };

const moveStock = (productId: string, delta: number) =>
  api<{ _id: string; stock: number }>(`/api/products/${productId}/stock`, {
    method: "POST",
    body: JSON.stringify({ delta }),
  });

type CartState = {
  items: CartItem[];
  customer: CartCustomer;
  paid: number | null;
  note: string;
  /** The DSR selling right now. Stays selected between memos. */
  dsr: string;
  setDsr: (name: string) => void;
  /** Discount typed on this memo: the number, and whether it is BDT or a percentage. */
  discountValue: string;
  discountUnit: DiscountUnit;
  setDiscount: (value: string, unit: DiscountUnit) => void;

  /** "+" button: reserves 1 unit in the database, then adds it to the memo. */
  addProduct: (p: Pick<Product, "_id" | "name" | "code" | "salePrice">) => Promise<boolean>;
  changeQty: (productId: string, delta: 1 | -1) => Promise<void>;
  /** Type an exact quantity (e.g. 20 or 30). Stock is reserved or released for the difference. */
  setQty: (productId: string, qty: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  setPrice: (productId: string, price: number) => void;
  setCustomer: (c: CartCustomer) => void;
  setPaid: (n: number | null) => void;
  setNote: (n: string) => void;
  /** Discard the memo and put every reserved unit back into stock. */
  discard: () => Promise<void>;
  /** After a successful checkout: empty the memo without touching stock. */
  reset: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: EMPTY_CUSTOMER,
      paid: null,
      note: "",
      dsr: "",
      setDsr: (dsr) => set({ dsr }),
      discountValue: "",
      discountUnit: "amount",
      setDiscount: (discountValue, discountUnit) => set({ discountValue, discountUnit }),

      addProduct: async (p) => {
        try {
          await moveStock(p._id, -1);
        } catch (e) {
          toast.error(`${p.name}: ${errorMessage(e)}`);
          return false;
        }
        set((s) => {
          const exists = s.items.some((i) => i.productId === p._id);
          return {
            items: exists
              ? s.items.map((i) => (i.productId === p._id ? { ...i, qty: i.qty + 1 } : i))
              : [
                  ...s.items,
                  { productId: p._id, name: p.name, code: p.code, qty: 1, unitPrice: p.salePrice, defaultPrice: p.salePrice },
                ],
          };
        });
        revalidate("/api/products");
        return true;
      },

      changeQty: async (productId, delta) => {
        const item = get().items.find((i) => i.productId === productId);
        if (!item) return;
        if (delta < 0 && item.qty === 1) return get().removeItem(productId);
        try {
          await moveStock(productId, -delta);
        } catch (e) {
          toast.error(errorMessage(e));
          return;
        }
        set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i)) }));
        revalidate("/api/products");
      },

      setQty: async (productId, qty) => {
        const item = get().items.find((i) => i.productId === productId);
        const next = Math.floor(qty);
        if (!item || !Number.isFinite(next) || next < 1 || next === item.qty) return;
        try {
          await moveStock(productId, -(next - item.qty)); // more in the memo = less in stock, and the reverse
        } catch (e) {
          toast.error(errorMessage(e));
          return;
        }
        set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, qty: next } : i)) }));
        revalidate("/api/products");
      },

      removeItem: async (productId) => {
        const item = get().items.find((i) => i.productId === productId);
        if (!item) return;
        try {
          await moveStock(productId, item.qty);
        } catch (e) {
          toast.error(errorMessage(e));
          return;
        }
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) }));
        revalidate("/api/products");
      },

      setPrice: (productId, price) =>
        set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, unitPrice: price } : i)) })),
      setCustomer: (customer) => set({ customer }),
      setPaid: (paid) => set({ paid }),
      setNote: (note) => set({ note }),

      discard: async () => {
        const { items } = get();
        const results = await Promise.allSettled(items.map((i) => moveStock(i.productId, i.qty)));
        if (results.some((r) => r.status === "rejected")) toast.error("Some stock could not be restored. Check inventory.");
        set({ items: [], customer: EMPTY_CUSTOMER, paid: null, note: "", discountValue: "", discountUnit: "amount" });
        revalidate("/api/products");
      },

      reset: () => set({ items: [], customer: EMPTY_CUSTOMER, paid: null, note: "", discountValue: "", discountUnit: "amount" }),
    }),
    {
      name: "pos-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, customer: s.customer, paid: s.paid, note: s.note, dsr: s.dsr, discountValue: s.discountValue, discountUnit: s.discountUnit }),
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.qty * i.unitPrice, 0);
