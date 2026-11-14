import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** The customer's cart. Kept on their phone, separate from the owner's counter memo. */
export type PortalLine = { productId: string; name: string; code: string; price: number; qty: number; max: number };

type State = {
  items: PortalLine[];
  note: string;
  add: (line: Omit<PortalLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  setNote: (note: string) => void;
  clear: () => void;
};

export const usePortalCart = create<State>()(
  persist(
    (set) => ({
      items: [],
      note: "",
      add: (line, qty = 1) =>
        set((s) => {
          const found = s.items.find((i) => i.productId === line.productId);
          if (found) {
            return { items: s.items.map((i) => (i.productId === line.productId ? { ...i, max: line.max, qty: Math.min(i.qty + qty, Math.max(line.max, 1)) } : i)) };
          }
          return { items: [...s.items, { ...line, qty: Math.min(qty, Math.max(line.max, 1)) }] };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.productId !== productId) : s.items.map((i) => (i.productId === productId ? { ...i, qty: Math.min(qty, Math.max(i.max, 1)) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      setNote: (note) => set({ note }),
      clear: () => set({ items: [], note: "" }),
    }),
    { name: "portal-cart-v1", storage: createJSONStorage(() => localStorage), partialize: (s) => ({ items: s.items, note: s.note }) },
  ),
);

export const portalCount = (items: PortalLine[]) => items.reduce((n, i) => n + i.qty, 0);
export const portalTotal = (items: PortalLine[]) => items.reduce((n, i) => n + i.qty * i.price, 0);
