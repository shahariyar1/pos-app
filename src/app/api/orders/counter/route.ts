import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { round2 } from "@/lib/utils";
import { counterOrderSchema } from "@/lib/validations";
import { Account } from "@/models/account";
import { nextOrderNo } from "@/models/counter";
import { Customer } from "@/models/customer";
import { Order } from "@/models/order";
import { Product } from "@/models/product";

/**
 * "Save as order" from the counter: the customer ordered but did not get the goods yet.
 * It is NOT a sale: no due is created and no stock is taken. When the goods are handed over,
 * open it in Orders and confirm it, and it becomes a normal memo (paid or due) at that moment.
 */
export const POST = withApi(async (req) => {
  const b = counterOrderSchema.parse(await req.json());

  const ids = [...new Set(b.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids } }).select("name code").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const qtyById = new Map<string, { qty: number; unitPrice: number }>();
  for (const i of b.items) {
    const prev = qtyById.get(i.productId);
    qtyById.set(i.productId, { qty: (prev?.qty ?? 0) + i.qty, unitPrice: round2(i.unitPrice) });
  }
  const items = [...qtyById].map(([productId, v]) => {
    const p = byId.get(productId);
    if (!p) throw new HttpError(404, "A product on this memo no longer exists");
    return { product: p._id, name: p.name, code: p.code, qty: v.qty, unitPrice: v.unitPrice };
  });

  // the customer: pick the existing one, or create it from the name (same as a normal memo)
  let customer = b.customerId ? await Customer.findById(b.customerId).lean() : null;
  if (b.customerId && !customer) throw new HttpError(404, "Customer not found");
  if (!customer) {
    customer = await Customer.findOneAndUpdate(
      { nameLower: b.customerName.toLowerCase() },
      { $setOnInsert: { name: b.customerName, nameLower: b.customerName.toLowerCase(), dueBalance: 0, address: b.customerAddress } },
      { upsert: true, new: true },
    ).lean();
  }
  if (!customer) throw new HttpError(500, "Could not save the customer");
  if (b.customerAddress && b.customerAddress !== (customer.address ?? "")) {
    await Customer.updateOne({ _id: customer._id }, { $set: { address: b.customerAddress } });
  }

  // if this shop has an online login, the order also shows in their "My orders"
  const account = await Account.findOne({ customer: customer._id }).select("_id").lean();

  const order = await Order.create({
    orderNo: await nextOrderNo(),
    source: "counter",
    account: account?._id,
    customer: customer._id,
    shopName: customer.name,
    address: b.customerAddress || customer.address || "",
    phone: customer.phone ?? "",
    dsr: b.dsr,
    items,
    subtotal: round2(items.reduce((s, i) => s + i.qty * i.unitPrice, 0)),
    note: b.note,
    status: "pending",
  });
  return NextResponse.json({ orderNo: order.orderNo }, { status: 201 });
});
