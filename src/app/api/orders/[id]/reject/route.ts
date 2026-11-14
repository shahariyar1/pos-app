import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { objectId, rejectOrderSchema } from "@/lib/validations";
import { Order } from "@/models/order";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const { reason } = rejectOrderSchema.parse(await req.json());
  const order = await Order.findOneAndUpdate(
    { _id: id, status: "pending" },
    { status: "rejected", ownerNote: reason, decidedAt: new Date() },
    { new: true },
  );
  if (!order) throw new HttpError(409, "This order is no longer waiting");
  return NextResponse.json({ ok: true });
});
