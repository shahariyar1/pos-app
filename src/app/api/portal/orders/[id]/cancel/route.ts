import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { requireAccount } from "@/lib/guards";
import { objectId } from "@/lib/validations";
import { Order } from "@/models/order";

type Ctx = { params: Promise<{ id: string }> };

/** A customer can cancel an order until the owner has looked at it. */
export const POST = withApi<Ctx>(async (_req, { params }) => {
  const account = await requireAccount();
  const id = objectId.parse((await params).id);
  const order = await Order.findOneAndUpdate(
    { _id: id, account: account._id, status: "pending" },
    { status: "cancelled", decidedAt: new Date() },
    { new: true },
  );
  if (!order) throw new HttpError(409, "This order can no longer be cancelled");
  return NextResponse.json({ ok: true });
}, "public");
