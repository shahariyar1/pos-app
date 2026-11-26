
import { NextResponse } from "next/server";
import { withApi, rx, type MongoFilter } from "@/lib/api-handler";
import { backfillGroupsOnce } from "@/lib/backfill-groups";
import { backfillWarrantyOnce } from "@/lib/backfill-warranty";
import {
  WARRANTY_DEFAULT_DAYS,
  isDisplayItem,
  logReceipt,
} from "@/lib/warranty";
import { productCreateSchema } from "@/lib/validations";
import { Product } from "@/models/product";
import { escapeGroupRegex, resolveProductGroup, uniqueGroupNames } from "@/lib/product-groups";

export const GET = withApi(async (req) => {
  await backfillGroupsOnce();
  await backfillWarrantyOnce();

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const location = sp.get("location");
  const group = sp.get("group");
  const stock = sp.get("stock");
  const limit = Math.min(Number(sp.get("limit")) || 200, 2000);

  const and: MongoFilter[] = [{ isActive: true }];

  // Search by name, code, location, family code
  // and all compatible phone models.
  for (const token of q.split(/\s+/).filter(Boolean)) {
    and.push({
      $or: [
        { name: rx(token) },
        { code: rx(token) },
        { location: rx(token) },
        { familyCode: rx(token) },
        { compatibleModels: rx(token) },
      ],
    });
  }

  if (location) and.push({ location });
  if (group) {
    const escapedGroup = escapeGroupRegex(group.trim());
    and.push({ group: new RegExp(`^${escapedGroup}$`, "i") });
  }

  if (stock === "out") {
    and.push({ stock: 0 });
  }

  if (stock === "in") {
    and.push({ stock: { $gt: 0 } });
  }

  if (stock === "low") {
    and.push({
      stock: { $gt: 0 },
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    });
  }

  const query = Product.find({ $and: and })
    .sort({ name: 1 })
    .limit(limit);

  const [data, total, locations, groups] = await Promise.all([
    query.lean(),
    Product.countDocuments({ $and: and }),
    Product.distinct("location", { isActive: true }),
    Product.distinct("group", { isActive: true }),
  ]);

  const dataWithMatches = data.map((product) => ({
    ...product,
    matchedCompatibleModels: q
      ? (product.compatibleModels ?? []).filter((model) =>
          q.split(/\s+/).filter(Boolean).every((token) => rx(token).test(model))
        )
      : [],
  }));

  return NextResponse.json({
    data: dataWithMatches,
    total,
    locations: locations.filter(Boolean).sort(),
    groups: uniqueGroupNames(groups),
    unlocked: true,
  });
});

export const POST = withApi(async (req) => {
  const body = productCreateSchema.parse(await req.json());

  const group = await resolveProductGroup(body.group);

  const warrantyDays =
    body.warrantyDays ||
    (isDisplayItem(body) ? WARRANTY_DEFAULT_DAYS : 0);

  const product = await Product.create({
    ...body,
    group,
    compatibleModels: body.compatibleModels || [],
    familyCode: body.familyCode || "",
    warrantyDays,
  });

  await logReceipt(product, product.stock);

  return NextResponse.json(product, { status: 201 });
});
