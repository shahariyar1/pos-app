import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { ensureLedger } from "@/lib/payments";
import { round2 } from "@/lib/utils";
import { objectId } from "@/lib/validations";
import { Customer } from "@/models/customer";
import { Sale } from "@/models/sale";

type Ctx = { params: Promise<{ id: string }> };

/** The tick button: the customer paid what was still due on this memo. */
export const POST = withApi<Ctx>(async (_req, { params }) => {
  const id = objectId.parse((await params).id);
  const sale = await Sale.findById(id);
  if (!sale) throw new HttpError(404, "Memo not found");
  const due = round2(sale.dueAfter);
  if (due <= 0) throw new HttpError(400, "This memo has nothing left to pay");

  ensureLedger(sale);
  sale.payments.push({ at: new Date(), amount: due });
  sale.paid = round2(sale.paid + due);
  sale.dueAfter = 0;
  sale.status = "paid";
  sale.history.push({ at: new Date(), text: `Marked as paid (received ${due})` });
  await sale.save();

  // An older memo's due can already be settled through a newer memo that carried it forward,
  // so never take more off the customer's balance than they actually owe.
  if (sale.customer) {
    const customer = await Customer.findById(sale.customer).lean();
    if (customer) {
      const effect = Math.min(due, Math.max(customer.dueBalance, 0));
      if (effect > 0) await Customer.updateOne({ _id: customer._id }, { $inc: { dueBalance: -effect } });
    }
  }
  return NextResponse.json(sale);
});
