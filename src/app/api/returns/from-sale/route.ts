import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { round2 } from "@/lib/utils";
import { returnFromSaleSchema } from "@/lib/validations";
import { Customer } from "@/models/customer";
import { Product } from "@/models/product";
import { Return } from "@/models/return";
import { Sale } from "@/models/sale";

/**
 * Return items from a memo.
 * - Items on the memo refund at the price the customer was charged, capped at sold minus already returned.
 * - "extra" items are not on this memo (sold a few days ago); their refund price is entered by hand.
 */
export const POST = withApi(async (req) => {
  const b = returnFromSaleSchema.parse(await req.json());

  const sale = await Sale.findById(b.saleId).lean();
  if (!sale) throw new HttpError(404, "Memo not found");

  // The customer may have been deleted since this memo was made
  const customer = sale.customer ? await Customer.findById(sale.customer).lean() : null;
  if (b.refundMode === "credit" && !customer) {
    throw new HttpError(400, "This memo has no customer on file, so the refund must be cash");
  }
  const customerName = sale.customerName === "Walk-in" ? "" : sale.customerName;

  // what was sold, per product (a product can sit on several lines at different prices)
  const sold = new Map<string, { name: string; code: string; qty: number; revenue: number; cost: number }>();
  for (const i of sale.items) {
    const key = String(i.product);
    const e = sold.get(key) ?? { name: i.name, code: i.code, qty: 0, revenue: 0, cost: 0 };
    e.qty += i.qty;
    e.revenue += i.qty * i.unitPrice;
    e.cost += i.qty * i.costPrice;
    sold.set(key, e);
  }

  const agg = await Return.aggregate<{ _id: unknown; qty: number }>([
    { $match: { invoiceNo: sale.invoiceNo } },
    { $group: { _id: "$product", qty: { $sum: "$qty" } } },
  ]);
  const returned = new Map(agg.map((a) => [String(a._id), a.qty]));

  const want = new Map<string, number>();
  for (const l of b.lines) want.set(l.productId, (want.get(l.productId) ?? 0) + l.qty);

  const records: Record<string, unknown>[] = [];
  const restock: [string, number][] = [];
  let refundTotal = 0;

  for (const [productId, qty] of want) {
    const s = sold.get(productId);
    if (!s) throw new HttpError(400, "One of the items is not on this memo");
    const left = s.qty - (returned.get(productId) ?? 0);
    if (qty > left) throw new HttpError(400, `${s.name}: only ${left} left to return`);

    const unitPrice = round2(s.revenue / s.qty);
    const unitCost = s.cost / s.qty;
    const refund = round2(qty * unitPrice);
    refundTotal = round2(refundTotal + refund);
    restock.push([productId, qty]);
    records.push({
      product: productId,
      productName: s.name,
      code: s.code,
      customer: customer?._id,
      customerName,
      invoiceNo: sale.invoiceNo,
      qty,
      unitPrice,
      costPrice: round2(unitCost),
      refundAmount: refund,
      refundMode: b.refundMode,
      restocked: b.restock,
      profitImpact: round2(refund - (b.restock ? unitCost * qty : 0)),
      reason: b.reason,
    });
  }

  if (b.extra.length) {
    const products = await Product.find({ _id: { $in: b.extra.map((e) => e.productId) } }).lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));
    for (const e of b.extra) {
      if (sold.has(e.productId)) {
        throw new HttpError(400, "That product is already on this memo. Use the table of memo items instead.");
      }
      const p = byId.get(e.productId);
      if (!p) throw new HttpError(404, "Product not found");
      const unitPrice = round2(e.unitPrice);
      const refund = round2(e.qty * unitPrice);
      refundTotal = round2(refundTotal + refund);
      restock.push([e.productId, e.qty]);
      records.push({
        product: p._id,
        productName: p.name,
        code: p.code,
        customer: customer?._id,
        customerName,
        // not on this memo, so it is not tied to the memo's invoice number
        qty: e.qty,
        unitPrice,
        costPrice: p.costPrice,
        refundAmount: refund,
        refundMode: b.refundMode,
        restocked: b.restock,
        profitImpact: round2(refund - (b.restock ? p.costPrice * e.qty : 0)),
        reason: [b.reason, `Not on ${sale.invoiceNo} (sold earlier)`].filter(Boolean).join(" · "),
      });
    }
  }

  if (b.restock) {
    await Promise.all(restock.map(([productId, qty]) => Product.updateOne({ _id: productId }, { $inc: { stock: qty } })));
  }

  let updated = null;
  if (b.refundMode === "credit" && customer) {
    updated = await Customer.findByIdAndUpdate(customer._id, { $inc: { dueBalance: -refundTotal } }, { new: true }).lean();
  }

  await Return.insertMany(records);

  return NextResponse.json(
    {
      created: records.length,
      refundTotal,
      customer: updated ? { _id: String(updated._id), name: updated.name, dueBalance: updated.dueBalance } : null,
    },
    { status: 201 },
  );
});
