import { round2 } from "@/lib/utils";

export type DiscountUnit = "amount" | "percent";

/** A discount typed as BDT or as a percentage, turned into BDT. It can never be more than the goods are worth. */
export function discountAmount(subtotal: number, value: number, unit: DiscountUnit) {
  const v = Number.isFinite(value) ? Math.max(value, 0) : 0;
  const raw = unit === "percent" ? (subtotal * Math.min(v, 100)) / 100 : v;
  return round2(Math.min(raw, Math.max(subtotal, 0)));
}
