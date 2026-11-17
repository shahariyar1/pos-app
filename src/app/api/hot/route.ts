import { NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import { withApi, HttpError, parseDate } from "@/lib/api-handler";
import { backfillWarrantyOnce } from "@/lib/backfill-warranty";
import { loadWarranty } from "@/lib/warranty";
import { Product } from "@/models/product";
import { Return } from "@/models/return";
import { Sale } from "@/models/sale";

/** Best-selling products in a date range, ranked by net units sold after returns. */
export const GET = withApi(async (req) => {
  await backfillWarrantyOnce();
  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");
  if (!from || !to) throw new HttpError(400, "Choose a date range");
  const group = sp.get("group");
  const limit = Math.min(Number(sp.get("limit")) || 30, 100);

  const base: PipelineStage[] = [{ $match: { createdAt: { $gte: from, $lte: to } } }, { $unwind: "$items" }];
  const returnBase: PipelineStage[] = [
    { $match: { createdAt: { $gte: from, $lte: to }, product: { $ne: null } } },
  ];
  if (group) {
    const ids = await Product.find({ group }).distinct("_id");
    base.push({ $match: { "items.product": { $in: ids } } });
    returnBase.push({ $match: { product: { $in: ids } } });
  }

  const [rows, totals, returnedRows, returnedTotals] = await Promise.all([
    Sale.aggregate<{ _id: unknown; name: string; code: string; qty: number; revenue: number; memos: number; last: Date }>([
      ...base,
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          code: { $first: "$items.code" },
          qty: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.qty", "$items.unitPrice"] } },
          memos: { $sum: 1 },
          last: { $max: "$createdAt" },
        },
      },
    ]),
    Sale.aggregate<{ qty: number; revenue: number }>([
      ...base,
      { $group: { _id: null, qty: { $sum: "$items.qty" }, revenue: { $sum: { $multiply: ["$items.qty", "$items.unitPrice"] } } } },
    ]),
    Return.aggregate<{ _id: unknown; qty: number; refund: number }>([
      ...returnBase,
      { $group: { _id: "$product", qty: { $sum: "$qty" }, refund: { $sum: "$refundAmount" } } },
    ]),
    Return.aggregate<{ qty: number; refund: number }>([
      ...returnBase,
      { $group: { _id: null, qty: { $sum: "$qty" }, refund: { $sum: "$refundAmount" } } },
    ]),
  ]);

  const returnedById = new Map(returnedRows.map((r) => [String(r._id), r]));
  const netRows = rows
    .map((r) => {
      const returned = returnedById.get(String(r._id));
      return {
        ...r,
        qty: Math.max(0, r.qty - (returned?.qty ?? 0)),
        revenue: Math.max(0, r.revenue - (returned?.refund ?? 0)),
      };
    })
    .filter((r) => r.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
  const rankedRows = netRows.slice(0, limit);

  const products = await Product.find({ _id: { $in: rankedRows.map((r) => r._id) } })
    .select("group stock warrantyDays createdAt")
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const warranty = await loadWarranty(products);

  return NextResponse.json({
    data: rankedRows.map((r) => ({
      productId: String(r._id),
      name: r.name,
      code: r.code,
      group: byId.get(String(r._id))?.group ?? "",
      stock: byId.get(String(r._id))?.stock ?? 0,
      batches: warranty.get(String(r._id)) ?? [],
      qty: r.qty,
      revenue: Math.round(r.revenue * 100) / 100,
      memos: r.memos,
      lastSold: r.last ? new Date(r.last).toISOString() : null,
    })),
    totalQty: Math.max(0, (totals[0]?.qty ?? 0) - (returnedTotals[0]?.qty ?? 0)),
    totalRevenue: Math.round(Math.max(0, (totals[0]?.revenue ?? 0) - (returnedTotals[0]?.refund ?? 0)) * 100) / 100,
  });
});
