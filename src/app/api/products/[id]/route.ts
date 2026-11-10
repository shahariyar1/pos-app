import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { isUnlocked } from "@/lib/auth";
import { objectId, productUpdateSchema } from "@/lib/validations";
import { logReceipt } from "@/lib/warranty";
import { Product } from "@/models/product";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const body = productUpdateSchema.parse(await req.json());
  if (body.costPrice !== undefined && !(await isUnlocked())) {
    throw new HttpError(403, "Unlock with the PIN to change cost price");
  }
  const before = await Product.findById(id).select("stock").lean();
  const product = await Product.findByIdAndUpdate(id, body, { new: true, runValidators: true });
  if (!product || !before) throw new HttpError(404, "Product not found");
  // more stock than before = new units arrived today (use "Receive stock" to give an earlier date)
  if (body.stock !== undefined && product.stock > before.stock) await logReceipt(product, product.stock - before.stock);
  return NextResponse.json(product);
});

/** Soft delete: past sales and returns keep their reference. */
export const DELETE = withApi<Ctx>(async (_req, { params }) => {
  const id = objectId.parse((await params).id);
  const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!product) throw new HttpError(404, "Product not found");
  return NextResponse.json({ ok: true });
});
