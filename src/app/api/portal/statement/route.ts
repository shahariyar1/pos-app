import { NextResponse } from "next/server";
import { withApi } from "@/lib/api-handler";
import { requireAccount } from "@/lib/guards";
import { Customer } from "@/models/customer";
import { Payment } from "@/models/payment";
import { Sale } from "@/models/sale";

/** The shop's own due and everything it has bought. Cost prices and internal notes are never sent. */
export const GET = withApi(async () => {
  const account = await requireAccount();
  if (!account.customer) return NextResponse.json({ due: 0, memos: [], payments: [] });

  const [customer, memos, payments] = await Promise.all([
    Customer.findById(account.customer).select("dueBalance").lean(),
    Sale.find({ customer: account.customer })
      .select("invoiceNo createdAt items.name items.code items.qty items.unitPrice subtotal discount returnTotal previousDue grandTotal paid dueAfter status")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Payment.find({ customer: account.customer }).select("amount note createdAt").sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  return NextResponse.json({ due: customer?.dueBalance ?? 0, memos, payments });
}, "public");
