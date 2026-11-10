import { NextResponse } from "next/server";
import { withApi, rx } from "@/lib/api-handler";
import { Customer } from "@/models/customer";
import { Product } from "@/models/product";

/** Feeds the Ctrl+K command palette. Never returns cost data. */
export const GET = withApi(async (req) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ products: [], customers: [] });

  const tokens = q.split(/\s+/).filter(Boolean);
  const [products, customers] = await Promise.all([
    Product.find({
      isActive: true,
      $and: tokens.map((t) => ({ $or: [{ name: rx(t) }, { code: rx(t) }] })),
    })
      .select("name code location stock salePrice")
      .sort({ name: 1 })
      .limit(6)
      .lean(),
    Customer.find({ $or: [{ name: rx(q) }, { phone: rx(q) }] })
      .select("name phone dueBalance")
      .sort({ name: 1 })
      .limit(6)
      .lean(),
  ]);
  return NextResponse.json({ products, customers });
});
