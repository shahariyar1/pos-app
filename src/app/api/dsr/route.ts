import { NextResponse } from "next/server";
import { withApi, parseDate } from "@/lib/api-handler";
import { paidByDsr } from "@/lib/payments";
import { dsrSchema } from "@/lib/validations";
import { Dsr } from "@/models/dsr";
import { Return } from "@/models/return";
import { Sale } from "@/models/sale";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const GET = withApi(async (req) => {
  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");
  const dsrs = await Dsr.find().sort({ name: 1 }).lean();
  const totals = new Map<string, { sold: number; due: number; memos: number; grossProfit: number; returnsImpact: number }>();
  let paid = new Map<string, number>();

  if (from && to) {
    const [byDsr, received, returned] = await Promise.all([
      Sale.aggregate<{ _id: string | null; sold: number; due: number; memos: number; grossProfit: number }>([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { dsr: "$dsr", invoiceNo: "$invoiceNo", subtotal: "$subtotal", returnTotal: "$returnTotal", discount: "$discount", dueAfter: "$dueAfter" },
          itemProfit: { $sum: { $multiply: [{ $subtract: ["$items.unitPrice", "$items.costPrice"] }, "$items.qty"] } },
        } },
        { $group: {
          _id: "$_id.dsr",
          sold: { $sum: { $subtract: [{ $subtract: ["$_id.subtotal", { $ifNull: ["$_id.returnTotal", 0] }] }, { $ifNull: ["$_id.discount", 0] }] } },
          due: { $sum: { $cond: [{ $gt: ["$_id.dueAfter", 0] }, "$_id.dueAfter", 0] } },
          memos: { $sum: 1 },
          grossProfit: { $sum: { $subtract: ["$itemProfit", { $ifNull: ["$_id.discount", 0] }] } },
        } },
      ]),
      paidByDsr(from, to),
      Return.aggregate<{ _id: string | null; impact: number }>([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $lookup: { from: "sales", localField: "invoiceNo", foreignField: "invoiceNo", as: "linkedSale" } },
        { $unwind: { path: "$linkedSale", preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: { $cond: [{ $ne: ["$dsr", ""] }, "$dsr", "$linkedSale.dsr"] },
          impact: { $sum: "$profitImpact" },
        } },
      ]),
    ]);
    for (const r of byDsr) totals.set(r._id ?? "", { sold: r.sold, due: r.due, memos: r.memos, grossProfit: r.grossProfit, returnsImpact: 0 });
    for (const r of returned) {
      const key = r._id ?? "";
      const current = totals.get(key) ?? { sold: 0, due: 0, memos: 0, grossProfit: 0, returnsImpact: 0 };
      current.returnsImpact = round2(r.impact);
      totals.set(key, current);
    }
    paid = received;
  }

  const totalsFor = (name: string) => {
    const t = totals.get(name);
    const grossProfit = round2(t?.grossProfit ?? 0);
    const returnsImpact = round2(t?.returnsImpact ?? 0);
    return {
      paid: round2(paid.get(name) ?? 0), sold: round2(t?.sold ?? 0),
      due: round2(t?.due ?? 0), memos: t?.memos ?? 0,
      grossProfit, returnsImpact, netProfit: round2(grossProfit - returnsImpact),
    };
  };

  const names = new Set([...totals.keys(), ...paid.keys()]);
  const all = { paid: 0, sold: 0, due: 0, memos: 0, grossProfit: 0, returnsImpact: 0 };
  for (const n of names) {
    const t = totalsFor(n);
    all.paid += t.paid; all.sold += t.sold; all.due += t.due; all.memos += t.memos;
    all.grossProfit += t.grossProfit; all.returnsImpact += t.returnsImpact;
  }
  const grossProfit = round2(all.grossProfit);
  const returnsImpact = round2(all.returnsImpact);
  return NextResponse.json({
    data: dsrs.map((d) => ({ _id: String(d._id), name: d.name, ...totalsFor(d.name) })),
    all: { paid: round2(all.paid), sold: round2(all.sold), due: round2(all.due), memos: all.memos,
      grossProfit, returnsImpact, netProfit: round2(grossProfit - returnsImpact) },
  });
});

export const POST = withApi(async (req) => {
  const { name } = dsrSchema.parse(await req.json());
  const dsr = await Dsr.create({ name, nameLower: name.toLowerCase() });
  return NextResponse.json(dsr, { status: 201 });
});
