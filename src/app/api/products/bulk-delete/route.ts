import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi } from "@/lib/api-handler";
import { objectId } from "@/lib/validations";
import { Product } from "@/models/product";

const bulkDeleteSchema = z.object({
  ids: z.array(objectId).min(1, "Select at least one product").max(2000, "You can delete up to 2000 products at a time"),
});

/** Soft-delete selected products so historical sales and returns remain intact. */
export const POST = withApi(async (req) => {
  const { ids } = bulkDeleteSchema.parse(await req.json());
  const uniqueIds = [...new Set(ids)];

  const result = await Product.updateMany(
    { _id: { $in: uniqueIds }, isActive: true },
    { $set: { isActive: false } }
  );

  return NextResponse.json({ ok: true, deletedCount: result.modifiedCount });
});
