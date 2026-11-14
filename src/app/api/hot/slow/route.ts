import { NextResponse } from "next/server";
import { withApi, HttpError, parseDate, rx, type MongoFilter } from "@/lib/api-handler";
import { backfillWarrantyOnce } from "@/lib/backfill-warranty";
import { loadWarranty } from "@/lib/warranty";
import { Product } from "@/models/product";
import { Sale } from "@/models/sale";

/**
 * Products that did NOT sell in the chosen period, with the date they last sold (null = never sold).
 * Oldest last-sale first, so the products that have stopped moving are at the top.
 */
export const GET = withApi(async (req) => {
  await backfillWarrantyOnce();
  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");
  if (!from || !to) throw new HttpError(400, "Choose a date range");
  const group = sp.get("group");
  const q = sp.get("q")?.trim() ?? "";
  const onlyInStock = sp.get("inStock") !== "false";
  const limit = Math.min(Number(sp.get("limit")) || 100, 300);

  const soldInRange = await Sale.aggregate<{ _id: unknown }>([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.product" } },
  ]);

  const filter: MongoFilter = { isActive: true, _id: { $nin: soldInRange.map((r) => r._id) } };
  if (group) filter.group = group;
  if (onlyInStock) filter.stock = { $gt: 0 };
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length) filter.$and = tokens.map((t) => ({ $or: [{ name: rx(t) }, { code: rx(t) }, { location: rx(t) }] }));

  const products = await Product.find(filter).select("name code group location stock warrantyDays createdAt").lean();
  const ids = products.map((p) => p._id);
  const lasts = ids.length
    ? await Sale.aggregate<{ _id: unknown; last: Date; sold: number }>([
        { $match: { "items.product": { $in: ids } } },
        { $unwind: "$items" },
        { $match: { "items.product": { $in: ids } } },
        { $group: { _id: "$items.product", last: { $max: "$createdAt" }, sold: { $sum: "$items.qty" } } },
      ])
    : [];
  const lastById = new Map(lasts.map((l) => [String(l._id), l]));
  const warranty = await loadWarranty(products);

  // A product with a warranty and units from different days becomes one row per day (e.g. 4 with 29 days left, 10 with 90 days left)
  const rows = products
    .flatMap((p) => {
      const l = lastById.get(String(p._id));
      const base = {
        productId: String(p._id),
        name: p.name,
        code: p.code,
        group: p.group ?? "",
        location: p.location ?? "",
        lastSold: l ? new Date(l.last).toISOString() : null,
        totalSold: l?.sold ?? 0,
      };
      const batches = warranty.get(String(p._id));
      if (batches?.length) return batches.map((b) => ({ ...base, stock: b.qty, daysLeft: b.daysLeft as number | null }));
      return [{ ...base, stock: p.stock, daysLeft: null as number | null }];
    })
    .sort((a, b) => {
      if (a.lastSold !== b.lastSold) {
        if (a.lastSold === null) return -1; // never sold first
        if (b.lastSold === null) return 1;
        return a.lastSold < b.lastSold ? -1 : 1;
      }
      return a.name.localeCompare(b.name) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
    });

  return NextResponse.json({
    data: rows.slice(0, limit),
    total: rows.length,
    stockUnits: rows.reduce((n, r) => n + r.stock, 0),
  });
});
