import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { objectId, paymentSchema } from "@/lib/validations";
import { round2 } from "@/lib/utils";
import { Customer } from "@/models/customer";
import { Payment } from "@/models/payment";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const { amount, note } = paymentSchema.parse(await req.json());
  const value = round2(amount);

  // Atomic: only succeeds if the payment does not exceed the current due.
  const customer = await Customer.findOneAndUpdate(
    { _id: id, dueBalance: { $gte: value } },
    { $inc: { dueBalance: -value } },
    { new: true },
  );
  if (!customer) throw new HttpError(409, "Payment is larger than the customer's current due");

  const payment = await Payment.create({ customer: id, customerName: customer.name, amount: value, note });
  return NextResponse.json({ payment, dueBalance: customer.dueBalance }, { status: 201 });
});
