import { NextResponse } from "next/server";
import { withApi, rx, type MongoFilter } from "@/lib/api-handler";
import { requireAccount } from "@/lib/guards";
import { SELECT, mergeProducts, viewsForIds } from "@/lib/portal-products";
import { Product } from "@/models/product";

const isId = (s: string) => /^[a-f\d]{24}$/i.test(s);

/**
 * The shop window. A customer sees price and stock, never cost or shelf location.
 *  - ?ids=a,b,c  : exactly those products (the cart uses this, so it never misses an item)
 *  - otherwise   : search / group filter, merged so one product is one card, with ?limit= for "show more"
 */
export const GET = withApi(async (req) => {
  await requireAccount();
  const sp = req.nextUrl.searchParams;

  const idsParam = sp.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").filter(isId).slice(0, 100);
    const data = await viewsForIds(ids);
    return NextResponse.json({ data, total: data.length, groups: [], regulars: [] });
  }

  const q = sp.get("q")?.trim() ?? "";
  const group = sp.get("group");
  const limit = Math.min(Number(sp.get("limit")) || 60, 300);

  const filter: MongoFilter = { isActive: true };
  if (group) filter.group = group;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length) filter.$and = tokens.map((t) => ({ $or: [{ name: rx(t) }, { code: rx(t) }] }));

  const [products, groups] = await Promise.all([
    Product.find(filter).select(SELECT).lean(),
    Product.distinct("group", { isActive: true }),
  ]);
  const merged = mergeProducts(products);

  return NextResponse.json({
    data: merged.slice(0, limit),
    total: merged.length,
    groups: groups.filter(Boolean).sort(),
    regulars: [],
  });
}, "public");
