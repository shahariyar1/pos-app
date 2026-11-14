import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { requireAccount } from "@/lib/guards";
import { normalizePhone } from "@/lib/phone";
import { round2 } from "@/lib/utils";
import { placeOrderSchema } from "@/lib/validations";
import { nextOrderNo } from "@/models/counter";
import { Order } from "@/models/order";
import { COLLATION, SELECT, keyOf, siblingFilter } from "@/lib/portal-products";
import { Product } from "@/models/product";

export const GET = withApi(async () => {
  const account = await requireAccount();
  const orders = await Order.find({ account: account._id })
    .select("orderNo items subtotal note status invoiceNo ownerNote createdAt decidedAt")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return NextResponse.json({ data: orders });
}, "public");

/**
 * Place an order. A phone number is required here (it is optional at sign-up).
 * Prices are copied from the shop's price list at this moment; the owner reviews and confirms it into a memo.
 */
export const POST = withApi(async (req) => {
  const account = await requireAccount();
  const b = placeOrderSchema.parse(await req.json());

  let phone = account.phone ?? "";
  if (b.phone) {
    const n = normalizePhone(b.phone);
    if (!n) throw new HttpError(400, "Enter a mobile number like 01XXXXXXXXX");
    phone = n;
  }
  if (!phone) throw new HttpError(400, "A phone number is required to place an order");

  const waiting = await Order.countDocuments({ account: account._id, status: "pending" });
  if (waiting >= 5) throw new HttpError(429, "You already have 5 orders waiting for the shop. Please wait for them to be confirmed.");

  // A product can be stocked on more than one shelf (several records). Customers order "the product";
  // we take it from whichever records hold it, biggest stock first.
  const ids = [...new Set(b.items.map((i) => i.productId))];
  const found = await Product.find({ _id: { $in: ids }, isActive: true }).select(SELECT).lean();
  const byId = new Map(found.map((p) => [String(p._id), p]));

  const wanted = new Map<string, { p: (typeof found)[number]; qty: number }>();
  for (const i of b.items) {
    const p = byId.get(i.productId);
    if (!p) throw new HttpError(404, "One of the products is no longer available. Please refresh the shop page.");
    const k = keyOf(p);
    wanted.set(k, { p: wanted.get(k)?.p ?? p, qty: (wanted.get(k)?.qty ?? 0) + i.qty });
  }

  const items: { product: unknown; name: string; code: string; qty: number; unitPrice: number }[] = [];
  for (const { p, qty } of wanted.values()) {
    const twins = (await Product.find(siblingFilter(p)).collation(COLLATION).select(SELECT).lean()).filter((t) => t.stock > 0).sort((a, b) => b.stock - a.stock);
    const total = twins.reduce((n, t) => n + t.stock, 0);
    if (qty > total) throw new HttpError(409, total > 0 ? `${p.name}: only ${total} in stock` : `${p.name} is out of stock`);
    let left = qty;
    for (const t of twins) {
      if (left <= 0) break;
      const take = Math.min(left, t.stock);
      items.push({ product: t._id, name: t.name, code: t.code, qty: take, unitPrice: p.salePrice });
      left -= take;
    }
  }

  if (phone !== account.phone) {
    account.phone = phone; // remember it for next time
    await account.save();
  }

  const order = await Order.create({
    orderNo: await nextOrderNo(),
    account: account._id,
    customer: account.customer,
    shopName: account.shopName,
    address: account.address,
    phone,
    items,
    subtotal: round2(items.reduce((s, i) => s + i.qty * i.unitPrice, 0)),
    note: b.note,
    status: "pending",
  });
  return NextResponse.json({ orderNo: order.orderNo, subtotal: order.subtotal }, { status: 201 });
}, "public");
