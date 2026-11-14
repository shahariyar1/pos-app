import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { SHOP_TZ_OFFSET_HOURS } from "@/lib/shop";
import { objectId, receiveSchema } from "@/lib/validations";
import { StockReceipt } from "@/models/stock-receipt";
import { Product } from "@/models/product";

type Ctx = { params: Promise<{ id: string }> };

/**
 * New units arrived. Adds them to the stock and records the arrival day, so the warranty
 * (90 days for displays) counts from then. Pick an earlier date if the goods came some days ago.
 */
export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const { qty, receivedOn } = receiveSchema.parse(await req.json());

  // noon at the shop's local time on that date
  const at = receivedOn ? new Date(Date.parse(`${receivedOn}T12:00:00Z`) - SHOP_TZ_OFFSET_HOURS * 3_600_000) : new Date();
  if (Number.isNaN(at.getTime())) throw new HttpError(400, "Pick a valid date");
  if (at.getTime() > Date.now() + 86_400_000) throw new HttpError(400, "The date cannot be in the future");

  const product = await Product.findOneAndUpdate({ _id: id, isActive: true }, { $inc: { stock: qty } }, { new: true });
  if (!product) throw new HttpError(404, "Product not found");

  // always logged here: the owner is explicitly saying when these arrived
  await StockReceipt.create({ product: product._id, qty, receivedAt: at });
  return NextResponse.json({ stock: product.stock });
});
