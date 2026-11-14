import { Sale } from "@/models/sale";

/**
 * Memos made before payments were logged have no payment entries, only a "paid" total.
 * Before adding the first new entry, record that old amount on the memo's own date so nothing disappears.
 */
export function ensureLedger(sale: { paid: number; createdAt?: Date }) {
  const s = sale as unknown as { payments: { length: number; push: (p: { at: Date; amount: number }) => unknown } };
  if (s.payments.length === 0 && sale.paid > 0) s.payments.push({ at: sale.createdAt ?? new Date(), amount: sale.paid });
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Money received on memos between two moments, per DSR name ("" = no DSR).
 * Uses the payment log, so a memo paid today counts today even if it was made last week.
 * Older memos without a log count their paid amount on the day they were made.
 */
export async function paidByDsr(from: Date, to: Date): Promise<Map<string, number>> {
  const [logged, legacy] = await Promise.all([
    Sale.aggregate<{ _id: string | null; paid: number }>([
      { $match: { payments: { $elemMatch: { at: { $gte: from, $lte: to } } } } },
      { $unwind: "$payments" },
      { $match: { "payments.at": { $gte: from, $lte: to } } },
      { $group: { _id: "$dsr", paid: { $sum: "$payments.amount" } } },
    ]),
    Sale.aggregate<{ _id: string | null; paid: number }>([
      {
        $match: {
          createdAt: { $gte: from, $lte: to },
          paid: { $gt: 0 },
          $or: [{ payments: { $exists: false } }, { payments: { $size: 0 } }],
        },
      },
      { $group: { _id: "$dsr", paid: { $sum: "$paid" } } },
    ]),
  ]);

  const out = new Map<string, number>();
  for (const r of [...logged, ...legacy]) out.set(r._id ?? "", round2((out.get(r._id ?? "") ?? 0) + r.paid));
  return out;
}
