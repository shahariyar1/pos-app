import { NextResponse } from "next/server";
import { withApi, HttpError, parseDate, rx, type MongoFilter } from "@/lib/api-handler";
import { backfillWarrantyOnce } from "@/lib/backfill-warranty";
import { loadWarranty } from "@/lib/warranty";
import { Product } from "@/models/product";
import { Sale } from "@/models/sale";

/**
 * Every product on one list: how much it sold in the period, when it last sold, where it is,
 * and, for products with a warranty, one row per arrival day (so 4 units with 29 days left and
 * 10 units with 90 days left are two rows even though the total stock is 14).
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
  const sortParam = sp.get("sort");
  // warranty-least = smallest number of days first (88, 89, 90); warranty-most = largest first (90, 90, 89, 88)
  const sort = sortParam === "warranty-least" || sortParam === "warranty-most" || sortParam === "name" ? sortParam : "sold";
  const limit = Math.min(Number(sp.get("limit")) || 150, 400);

  const filter: MongoFilter = { isActive: true };
  if (group) filter.group = group;
  if (onlyInStock) filter.stock = { $gt: 0 };
  if (sp.get("warrantyOnly") === "true") filter.warrantyDays = { $gt: 0 };
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length) filter.$and = tokens.map((t) => ({ $or: [{ name: rx(t) }, { code: rx(t) }, { location: rx(t) }] }));

  const products = await Product.find(filter).select("name code group location stock warrantyDays createdAt").lean();
  const ids = products.map((p) => p._id);

  const [stats, warranty] = await Promise.all([
    ids.length
      ? Sale.aggregate<{ _id: unknown; sold: number; last: Date }>([
          { $match: { "items.product": { $in: ids } } },
          { $unwind: "$items" },
          { $match: { "items.product": { $in: ids } } },
          {
            $group: {
              _id: "$items.product",
              sold: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", from] }, { $lte: ["$createdAt", to] }] }, "$items.qty", 0] } },
              last: { $max: "$createdAt" },
            },
          },
        ])
      : [],
    loadWarranty(products),
  ]);
  const statById = new Map(stats.map((s) => [String(s._id), s]));

  const rows = products.flatMap((p) => {
    const s = statById.get(String(p._id));
    const base = {
      productId: String(p._id),
      name: p.name,
      code: p.code,
      group: p.group ?? "",
      location: p.location ?? "",
      sold: s?.sold ?? 0,
      lastSold: s ? new Date(s.last).toISOString() : null,
    };
    const batches = warranty.get(String(p._id));
    if (batches?.length) return batches.map((b) => ({ ...base, key: `${base.productId}:${b.daysLeft}`, qty: b.qty, daysLeft: b.daysLeft as number | null }));
    return [{ ...base, key: base.productId, qty: p.stock, daysLeft: null as number | null }];
  });

  rows.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
    // products without a warranty always go to the bottom
    if (sort === "warranty-least") return (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999) || a.name.localeCompare(b.name);
    if (sort === "warranty-most") return (b.daysLeft ?? -99999) - (a.daysLeft ?? -99999) || a.name.localeCompare(b.name);
    return b.sold - a.sold || a.name.localeCompare(b.name) || (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
  });

  return NextResponse.json({
    data: rows.slice(0, limit),
    total: rows.length,
    stockUnits: rows.reduce((n, r) => n + r.qty, 0),
    expiring: rows.filter((r) => r.daysLeft !== null && r.daysLeft <= 15).length,
  });
});
