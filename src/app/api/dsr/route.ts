import { NextResponse } from "next/server";
import { withApi, parseDate } from "@/lib/api-handler";
import { paidByDsr } from "@/lib/payments";
import { dsrSchema } from "@/lib/validations";
import { Dsr } from "@/models/dsr";
import { Sale } from "@/models/sale";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * All DSRs. With ?from=&to= each one also gets, for that range:
 *  - paid: money actually received (this is the number the dashboard leads with),
 *  - sold: value of the memos they made, after returns,
 *  - due: still unpaid on those memos.
 */
export const GET = withApi(async (req) => {
  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");

  const dsrs = await Dsr.find().sort({ name: 1 }).lean();
  const sales = new Map<string, { sold: number; due: number; memos: number }>();
  let paid = new Map<string, number>();

  if (from && to) {
    const [byDsr, received] = await Promise.all([
      Sale.aggregate<{ _id: string | null; sold: number; due: number; memos: number }>([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: "$dsr",
            sold: { $sum: { $subtract: [{ $subtract: ["$subtotal", { $ifNull: ["$returnTotal", 0] }] }, { $ifNull: ["$discount", 0] }] } },
            due: { $sum: { $cond: [{ $gt: ["$dueAfter", 0] }, "$dueAfter", 0] } },
            memos: { $sum: 1 },
          },
        },
      ]),
      paidByDsr(from, to),
    ]);
    for (const r of byDsr) sales.set(r._id ?? "", { sold: r.sold, due: r.due, memos: r.memos });
    paid = received;
  }

  const totalsFor = (name: string) => ({
    paid: round2(paid.get(name) ?? 0),
    sold: round2(sales.get(name)?.sold ?? 0),
    due: round2(sales.get(name)?.due ?? 0),
    memos: sales.get(name)?.memos ?? 0,
  });

  const names = new Set([...sales.keys(), ...paid.keys()]);
  const all = { paid: 0, sold: 0, due: 0, memos: 0 };
  for (const n of names) {
    const t = totalsFor(n);
    all.paid += t.paid;
    all.sold += t.sold;
    all.due += t.due;
    all.memos += t.memos;
  }

  return NextResponse.json({
    data: dsrs.map((d) => ({ _id: String(d._id), name: d.name, ...totalsFor(d.name) })),
    all: { paid: round2(all.paid), sold: round2(all.sold), due: round2(all.due), memos: all.memos },
  });
});

export const POST = withApi(async (req) => {
  const { name } = dsrSchema.parse(await req.json());
  const dsr = await Dsr.create({ name, nameLower: name.toLowerCase() });
  return NextResponse.json(dsr, { status: 201 });
});
