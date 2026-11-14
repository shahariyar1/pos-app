import { NextResponse } from "next/server";
import { withApi } from "@/lib/api-handler";
import { groupFromCode } from "@/lib/groups";
import { WARRANTY_DEFAULT_DAYS, isDisplayItem } from "@/lib/warranty";
import { StockReceipt } from "@/models/stock-receipt";
import { inventoryImportSchema } from "@/lib/validations";
import { Product } from "@/models/product";

/**
 * Saves the items from an uploaded file.
 * New items are created. For items that already exist, "existing" decides:
 *  - skip:      leave them alone (running the same file twice adds nothing)
 *  - add_stock: add the file's stock to the current stock
 *  - replace:   overwrite location, cost, sale price and stock with the file's data
 * An existing item is found by name + code + location. In replace mode, an item that moved to a new location
 * is still found by name + code (or by name alone) when that match is unique.
 */
export const POST = withApi(async (req) => {
  const b = inventoryImportSchema.parse(await req.json());

  let created = 0;
  let skipped = 0;
  let restocked = 0;
  let replaced = 0;

  if (b.products.length) {
    await Product.syncIndexes(); // older databases still have the "code must be unique" index

    const low = (s: string) => s.toLowerCase();
    const keyOf = (n: string, c: string, l: string) => `${low(n)}|${low(c)}|${low(l)}`;
    const ncOf = (n: string, c: string) => `${low(n)}|${low(c)}`;

    const all = await Product.find().select("name code location stock warrantyDays").lean();
    const info = new Map(all.map((p) => [String(p._id), { stock: p.stock, warranty: p.warrantyDays ?? 0 }]));
    const receipts: { product: unknown; qty: number }[] = [];
    const byKey = new Map<string, string>();
    const byNameCode = new Map<string, string[]>();
    const byName = new Map<string, string[]>();
    for (const p of all) {
      const id = String(p._id);
      byKey.set(keyOf(p.name, p.code, p.location ?? ""), id);
      byNameCode.set(ncOf(p.name, p.code), [...(byNameCode.get(ncOf(p.name, p.code)) ?? []), id]);
      byName.set(low(p.name), [...(byName.get(low(p.name)) ?? []), id]);
    }

    // pass 1: exact matches claim their product first
    const plans = b.products.map((p) => ({ p, id: byKey.get(keyOf(p.name, p.code, p.location)), exact: true }));
    const used = new Set(plans.filter((x) => x.id).map((x) => x.id as string));

    // pass 2 (replace only): items that moved to another location
    if (b.existing === "replace") {
      for (const x of plans) {
        if (x.id) continue;
        const nc = byNameCode.get(ncOf(x.p.name, x.p.code));
        const pool = nc ?? (byName.get(low(x.p.name)) ?? []);
        if (pool.length === 1 && !used.has(pool[0])) {
          x.id = pool[0];
          x.exact = false;
          used.add(pool[0]);
        }
      }
    }

    const fresh: Record<string, unknown>[] = [];
    const freshKeys = new Set<string>();
    const writes: { id: string; update: Record<string, unknown> }[] = [];

    for (const { p, id, exact } of plans) {
      if (!id) {
        const k = keyOf(p.name, p.code, p.location);
        if (freshKeys.has(k)) continue;
        freshKeys.add(k);
        fresh.push({ ...p, group: p.group || groupFromCode(p.code), warrantyDays: isDisplayItem(p) ? WARRANTY_DEFAULT_DAYS : 0, lowStockThreshold: low(p.code) === "cover" ? 2 : 5, isActive: true });
      } else if (b.existing === "replace") {
        writes.push({ id, update: { $set: { name: p.name, code: p.code, location: p.location, group: p.group || groupFromCode(p.code), costPrice: p.costPrice, salePrice: p.salePrice, stock: p.stock, isActive: true } } });
        replaced += 1;
        const o = info.get(id);
        if (o && o.warranty > 0 && p.stock > o.stock) receipts.push({ product: id, qty: p.stock - o.stock });
      } else if (b.existing === "add_stock" && exact && p.stock > 0) {
        writes.push({ id, update: { $inc: { stock: p.stock }, $set: { isActive: true } } });
        restocked += 1;
        if ((info.get(id)?.warranty ?? 0) > 0) receipts.push({ product: id, qty: p.stock });
      } else {
        skipped += 1;
      }
    }

    if (fresh.length) {
      const made = await Product.insertMany(fresh, { ordered: false });
      for (const m of made) if ((m.warrantyDays ?? 0) > 0 && m.stock > 0) receipts.push({ product: m._id, qty: m.stock });
    }
    created = fresh.length;
    if (receipts.length) await StockReceipt.insertMany(receipts.map((r) => ({ ...r, receivedAt: new Date() })));

    for (let i = 0; i < writes.length; i += 100) {
      await Promise.all(writes.slice(i, i + 100).map((w) => Product.updateOne({ _id: w.id }, w.update)));
    }
  }

  return NextResponse.json({ created, skipped, restocked, replaced });
});
