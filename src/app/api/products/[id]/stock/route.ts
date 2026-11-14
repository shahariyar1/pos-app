import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { objectId, stockAdjustSchema } from "@/lib/validations";
import { Product } from "@/models/product";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Atomic stock move used by the memo's "+" button.
 * delta < 0 reserves stock (only succeeds if enough is left, so two tablets can't oversell).
 * delta > 0 gives it back (removing a line, clearing the memo).
 */
export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const { delta } = stockAdjustSchema.parse(await req.json());

  const filter = delta < 0 ? { _id: id, isActive: true, stock: { $gte: -delta } } : { _id: id };
  const updated = await Product.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true }).select("stock");
  if (!updated) throw new HttpError(409, delta < 0 ? "Not enough stock" : "Product not found");

  return NextResponse.json({ _id: updated._id, stock: updated.stock });
});
