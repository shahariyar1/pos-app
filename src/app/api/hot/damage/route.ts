import { NextResponse } from "next/server";
import { withApi, HttpError, parseDate, rx, type MongoFilter } from "@/lib/api-handler";
import { isUnlocked } from "@/lib/auth";
import { Product } from "@/models/product";
import { Return } from "@/models/return";

/** Items that came back damaged in a date range, newest first. */
export const GET = withApi(async (req) => {
  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");
  if (!from || !to) throw new HttpError(400, "Choose a date range");
  const group = sp.get("group");
  const q = sp.get("q")?.trim() ?? "";

  const filter: MongoFilter = { damaged: true, createdAt: { $gte: from, $lte: to } };
  if (group) {
    const ids = await Product.find({ group }).distinct("_id");
    filter.product = { $in: ids };
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length) {
    filter.$and = tokens.map((t) => ({
      $or: [{ productName: rx(t) }, { code: rx(t) }, { invoiceNo: rx(t) }, { customerName: rx(t) }],
    }));
  }

  const unlocked = await isUnlocked();
  const rows = await Return.find(filter).sort({ createdAt: -1 }).limit(300).lean();

  const ids = rows.map((r) => r.product).filter(Boolean);
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).select("group").lean() : [];
  const groupById = new Map(products.map((p) => [String(p._id), p.group ?? ""]));

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const data = rows.map((r) => ({
    id: String(r._id),
    productName: r.productName,
    code: r.code,
    group: r.product ? (groupById.get(String(r.product)) ?? "") : "",
    qty: r.qty,
    refundAmount: r.refundAmount,
    ...(unlocked ? { costValue: round2(r.costPrice * r.qty) } : {}),
    invoiceNo: r.invoiceNo ?? "",
    customerName: r.customerName ?? "",
    reason: r.reason ?? "",
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  return NextResponse.json({
    data,
    totalQty: data.reduce((n, r) => n + r.qty, 0),
    totalRefund: round2(data.reduce((n, r) => n + r.refundAmount, 0)),
    ...(unlocked ? { totalCost: round2(data.reduce((n, r) => n + (r.costValue ?? 0), 0)) } : {}),
    unlocked,
  });
});
