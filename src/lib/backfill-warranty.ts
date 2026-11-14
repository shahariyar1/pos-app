import { WARRANTY_DEFAULT_DAYS } from "@/lib/warranty";
import { Counter } from "@/models/counter";
import { Product } from "@/models/product";

/** Once: products whose name, code or group says "display" get the 90 day warranty. */
export async function backfillWarrantyOnce() {
  const previous = await Counter.findOneAndUpdate({ _id: "warranty_backfilled" }, { $setOnInsert: { seq: 1 } }, { upsert: true });
  if (previous) return;
  const display = /display/i;
  await Product.updateMany(
    {
      $and: [
        { $or: [{ warrantyDays: { $exists: false } }, { warrantyDays: 0 }] },
        { $or: [{ name: display }, { code: display }, { group: display }] },
      ],
    },
    { $set: { warrantyDays: WARRANTY_DEFAULT_DAYS } },
  );
}
