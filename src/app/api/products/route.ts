
import { NextResponse } from "next/server";
import { withApi, rx, type MongoFilter } from "@/lib/api-handler";
import { isUnlocked } from "@/lib/auth";
import { backfillGroupsOnce } from "@/lib/backfill-groups";
import { backfillWarrantyOnce } from "@/lib/backfill-warranty";
import {
  WARRANTY_DEFAULT_DAYS,
  isDisplayItem,
  logReceipt,
} from "@/lib/warranty";
import { productCreateSchema } from "@/lib/validations";
import { Product } from "@/models/product";

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
  if (group) and.push({ group });

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

  const unlocked = await isUnlocked();

  const query = Product.find({ $and: and })
    .sort({ name: 1 })
    .limit(limit);

  if (!unlocked) query.select("-costPrice");

  const [data, total, locations, groups] = await Promise.all([
    query.lean(),
    Product.countDocuments({ $and: and }),
    Product.distinct("location", { isActive: true }),
    Product.distinct("group", { isActive: true }),
  ]);

  return NextResponse.json({
    data,
    total,
    locations: locations.filter(Boolean).sort(),
    groups: groups.filter(Boolean).sort(),
    unlocked,
  });
});

export const POST = withApi(async (req) => {
  const body = productCreateSchema.parse(await req.json());

  const warrantyDays =
    body.warrantyDays ||
    (isDisplayItem(body) ? WARRANTY_DEFAULT_DAYS : 0);

  const product = await Product.create({
    ...body,
    compatibleModels: body.compatibleModels || [],
    familyCode: body.familyCode || "",
    warrantyDays,
  });

  await logReceipt(product, product.stock);

  return NextResponse.json(product, { status: 201 });
});
