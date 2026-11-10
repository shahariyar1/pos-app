import { NextResponse } from "next/server";
import { withApi, parseDate } from "@/lib/api-handler";
import { isUnlocked } from "@/lib/auth";
import { paidByDsr } from "@/lib/payments";
import { round2 } from "@/lib/utils";
import { Customer } from "@/models/customer";
import { Payment } from "@/models/payment";
import { Return } from "@/models/return";
import { Sale } from "@/models/sale";

export const GET = withApi(async (req) => {
  const sp = req.nextUrl.searchParams;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000 - 1);
  const from = parseDate(sp.get("from"), "from") ?? startOfToday;
  const to = parseDate(sp.get("to"), "to") ?? endOfToday;
  const range = { createdAt: { $gte: from, $lte: to } };

  const unlocked = await isUnlocked();

  const [sales, profitAgg, payments, returns, dues, memoPaid] = await Promise.all([
    Sale.aggregate<{ revenue: number; paid: number; invoices: number; itemsSold: number; discount: number }>([
      { $match: range },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $subtract: ["$subtotal", { $ifNull: ["$discount", 0] }] } },
          discount: { $sum: { $ifNull: ["$discount", 0] } },
          paid: { $sum: "$paid" },
          invoices: { $sum: 1 },
          itemsSold: { $sum: { $sum: "$items.qty" } },
        },
      },
    ]),
    // Cost data is only aggregated when the PIN session is active.
    unlocked
      ? Sale.aggregate<{ profit: number }>([
          { $match: range },
          { $unwind: "$items" },
          {
            $group: {
              _id: null,
              profit: { $sum: { $multiply: [{ $subtract: ["$items.unitPrice", "$items.costPrice"] }, "$items.qty"] } },
            },
          },
        ])
      : Promise.resolve([] as { profit: number }[]),
    Payment.aggregate<{ total: number }>([{ $match: range }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Return.aggregate<{ total: number; count: number; impact: number }>([
      { $match: range },
      { $group: { _id: null, total: { $sum: "$refundAmount" }, count: { $sum: 1 }, impact: { $sum: "$profitImpact" } } },
    ]),
    Customer.aggregate<{ total: number; count: number }>([
      { $match: { dueBalance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$dueBalance" }, count: { $sum: 1 } } },
    ]),
    paidByDsr(from, to),
  ]);

  const s = sales[0];
  const r = returns[0];
  // margin on the items, less the discounts given
  const gross = round2((profitAgg[0]?.profit ?? 0) - (s?.discount ?? 0));
  const returnsImpact = round2(r?.impact ?? 0);

  return NextResponse.json({
    revenue: round2(s?.revenue ?? 0),
    // money received in the range: memo payments (by the day they were received) + payments collected from customers
    collected: round2([...memoPaid.values()].reduce((a, b) => a + b, 0) + (payments[0]?.total ?? 0)),
    invoices: s?.invoices ?? 0,
    itemsSold: s?.itemsSold ?? 0,
    returnsTotal: round2(r?.total ?? 0),
    returnsCount: r?.count ?? 0,
    outstandingDue: round2(dues[0]?.total ?? 0),
    customersWithDue: dues[0]?.count ?? 0,
    unlocked,
    profit: unlocked ? { gross, returnsImpact, net: round2(gross - returnsImpact) } : undefined,
  });
});
