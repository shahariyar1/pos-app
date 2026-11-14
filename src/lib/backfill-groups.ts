import { escapeRegex } from "@/lib/api-handler";
import { GROUPS } from "@/lib/groups";
import { Counter } from "@/models/counter";
import { Product } from "@/models/product";

/** Once: products whose code is a known group (Cover, Charger ...) get that group, so existing stock is grouped too. */
export async function backfillGroupsOnce() {
  const previous = await Counter.findOneAndUpdate({ _id: "groups_backfilled" }, { $setOnInsert: { seq: 1 } }, { upsert: true });
  if (previous) return;
  for (const g of GROUPS) {
    await Product.updateMany(
      { code: new RegExp(`^${escapeRegex(g)}$`, "i"), $or: [{ group: { $exists: false } }, { group: "" }] },
      { $set: { group: g } },
    );
  }
}
