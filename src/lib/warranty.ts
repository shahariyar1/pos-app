import { SHOP_TZ_OFFSET_HOURS } from "@/lib/shop";
import { StockReceipt } from "@/models/stock-receipt";

export const WARRANTY_DEFAULT_DAYS = 90;

/** Displays (screens) carry the 90 day warranty: anything with "display" in its name, code or group. */
export const isDisplayItem = (p: { name: string; code?: string | null; group?: string | null }) =>
  /display/i.test(`${p.name} ${p.code ?? ""} ${p.group ?? ""}`);

const dayIndex = (d: Date) => Math.floor((d.getTime() + SHOP_TZ_OFFSET_HOURS * 3_600_000) / 86_400_000);

/** Warranty days left. Received today with a 90 day warranty = 90, tomorrow = 89 ... Can go below 0 (over). */
export const warrantyLeft = (receivedAt: Date, warrantyDays: number, now = new Date()) =>
  warrantyDays - (dayIndex(now) - dayIndex(receivedAt));

export type Batch = { qty: number; receivedAt: Date; opening: boolean };
export type WarrantyBatch = { qty: number; daysLeft: number };

/**
 * What is on the shelf, by arrival day. Because the oldest units are sold first, the units still
 * in stock are the most recently received ones. `receipts` must be newest first.
 * Stock that no receipt explains (it was there before warranties were tracked) counts from `openingAt`.
 */
export function batchesFrom(stock: number, receipts: { qty: number; receivedAt: Date }[], openingAt: Date): Batch[] {
  let left = stock;
  const out: Batch[] = [];
  for (const r of receipts) {
    if (left <= 0) break;
    const take = Math.min(left, r.qty);
    out.push({ qty: take, receivedAt: r.receivedAt, opening: false });
    left -= take;
  }
  if (left > 0) out.push({ qty: left, receivedAt: openingAt, opening: true });
  return out;
}

type Tracked = { _id: unknown; stock: number; createdAt?: Date | null; warrantyDays?: number | null };

/** Batches (grouped by warranty days left, least warranty first) for every product that has a warranty and stock. */
export async function loadWarranty(products: Tracked[]): Promise<Map<string, WarrantyBatch[]>> {
  const tracked = products.filter((p) => (p.warrantyDays ?? 0) > 0 && p.stock > 0);
  const out = new Map<string, WarrantyBatch[]>();
  if (!tracked.length) return out;

  const receipts = await StockReceipt.find({ product: { $in: tracked.map((p) => p._id) } })
    .sort({ receivedAt: -1 })
    .lean();
  const byProduct = new Map<string, { qty: number; receivedAt: Date }[]>();
  for (const r of receipts) {
    const k = String(r.product);
    const list = byProduct.get(k) ?? [];
    list.push({ qty: r.qty, receivedAt: r.receivedAt });
    byProduct.set(k, list);
  }

  const now = new Date();
  for (const p of tracked) {
    const batches = batchesFrom(p.stock, byProduct.get(String(p._id)) ?? [], p.createdAt ?? now);
    const byDays = new Map<number, number>(); // two receipts that expire on the same day are one line
    for (const b of batches) {
      const left = warrantyLeft(b.receivedAt, p.warrantyDays as number, now);
      byDays.set(left, (byDays.get(left) ?? 0) + b.qty);
    }
    out.set(
      String(p._id),
      [...byDays].map(([daysLeft, qty]) => ({ qty, daysLeft })).sort((a, b) => a.daysLeft - b.daysLeft),
    );
  }
  return out;
}

/** Log that `qty` units arrived (only for products that have a warranty to track). */
export async function logReceipt(product: { _id: unknown; warrantyDays?: number | null }, qty: number, at = new Date()) {
  if ((product.warrantyDays ?? 0) > 0 && qty > 0) await StockReceipt.create({ product: product._id, qty, receivedAt: at });
}
