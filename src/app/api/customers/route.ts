import { NextResponse } from "next/server";
import { withApi, rx, type MongoFilter } from "@/lib/api-handler";
import { customerCreateSchema } from "@/lib/validations";
import { Customer } from "@/models/customer";

export const GET = withApi(async (req) => {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const limit = Math.min(Number(sp.get("limit")) || 200, 500);
  const filter: MongoFilter = {};
  if (q) filter.$or = [{ name: rx(q) }, { phone: rx(q) }];
  if (sp.get("hasDue") === "true") filter.dueBalance = { $gt: 0 };

  const [data, totals] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).limit(limit).lean(),
    Customer.aggregate<{ total: number }>([
      { $match: { dueBalance: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$dueBalance" } } },
    ]),
  ]);
  return NextResponse.json({ data, totalDue: totals[0]?.total ?? 0 });
});

export const POST = withApi(async (req) => {
  const body = customerCreateSchema.parse(await req.json());
  const customer = await Customer.create({ ...body, nameLower: body.name.toLowerCase() });
  return NextResponse.json(customer, { status: 201 });
});
