import { NextResponse } from "next/server";
import { withApi, HttpError, parseDate, rx, type MongoFilter } from "@/lib/api-handler";
import { isUnlocked } from "@/lib/auth";
import { round2 } from "@/lib/utils";
import { returnSchema } from "@/lib/validations";
import { Customer } from "@/models/customer";
import { Product } from "@/models/product";
import { Return } from "@/models/return";

export const GET = withApi(async (req) => {
  const sp = req.nextUrl.searchParams;
  const filter: MongoFilter = {};
  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const q = sp.get("q")?.trim();
  if (q) filter.$or = [{ productName: rx(q) }, { code: rx(q) }, { customerName: rx(q) }, { invoiceNo: rx(q) }];

  const unlocked = await isUnlocked();
  const query = Return.find(filter).sort({ createdAt: -1 }).limit(500);
  if (!unlocked) query.select("-costPrice -profitImpact");

  const [data, totals] = await Promise.all([
    query.lean(),
    Return.aggregate<{ total: number }>([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$refundAmount" } } },
    ]),
  ]);
  return NextResponse.json({ data, totalRefunded: totals[0]?.total ?? 0, unlocked });
});

export const POST = withApi(async (req) => {
  const b = returnSchema.parse(await req.json());

  const product = await Product.findById(b.productId).lean();
  if (!product) throw new HttpError(404, "Product not found");

  const customer = b.customerId ? await Customer.findById(b.customerId).lean() : null;
  if (b.customerId && !customer) throw new HttpError(404, "Customer not found");

  const refundAmount = round2(b.qty * b.unitPrice);

  // Returned goods go back on the shelf automatically (untick "restock" for damaged items).
  if (b.restock) await Product.updateOne({ _id: product._id }, { $inc: { stock: b.qty } });

  // "credit" reduces what the customer owes (can go negative = store credit).
  if (b.refundMode === "credit" && customer) {
    await Customer.updateOne({ _id: customer._id }, { $inc: { dueBalance: -refundAmount } });
  }

  const record = await Return.create({
    product: product._id,
    productName: product.name,
    code: product.code,
    customer: customer?._id,
    customerName: customer?.name ?? "",
    invoiceNo: b.invoiceNo,
    qty: b.qty,
    unitPrice: b.unitPrice,
    costPrice: product.costPrice,
    refundAmount,
    refundMode: b.refundMode,
    restocked: b.restock,
    profitImpact: round2(refundAmount - (b.restock ? product.costPrice * b.qty : 0)),
    reason: b.reason,
  });
  return NextResponse.json(record, { status: 201 });
});
