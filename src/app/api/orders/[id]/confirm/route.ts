import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { round2 } from "@/lib/utils";
import { confirmOrderSchema, objectId } from "@/lib/validations";
import { Account } from "@/models/account";
import { nextInvoiceNo } from "@/models/counter";
import { Customer } from "@/models/customer";
import { Order } from "@/models/order";
import { Product } from "@/models/product";
import { Sale } from "@/models/sale";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The owner confirms an order: it becomes a memo.
 * Quantities and prices may be changed first. Stock is taken here (all or nothing),
 * and the shop's due is calculated exactly like a memo made at the counter.
 */
export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const b = confirmOrderSchema.parse(await req.json());

  const order = await Order.findById(id);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "pending") throw new HttpError(409, `This order is already ${order.status}`);

  let customer = order.customer ? await Customer.findById(order.customer).lean() : null;
  if (!customer) {
    const account = await Account.findById(order.account).select("customer").lean();
    if (account?.customer) customer = await Customer.findById(account.customer).lean();
  }
  if (!customer) throw new HttpError(409, "This shop has no customer record yet. Approve its account first.");

  const ordered = new Map(order.items.map((i) => [String(i.product), i]));
  for (const it of b.items) {
    if (!ordered.has(it.productId)) throw new HttpError(400, "An item that is not on this order was sent");
  }

  const reserved: { id: string; qty: number }[] = [];
  const lines: { product: unknown; name: string; code: string; qty: number; unitPrice: number; defaultPrice: number; costPrice: number }[] = [];
  try {
    for (const it of b.items) {
      const p = await Product.findOneAndUpdate(
        { _id: it.productId, isActive: true, stock: { $gte: it.qty } },
        { $inc: { stock: -it.qty } },
        { new: true },
      );
      if (!p) throw new HttpError(409, `Not enough stock for ${ordered.get(it.productId)?.name ?? "a product"}`);
      reserved.push({ id: it.productId, qty: it.qty });
      lines.push({ product: p._id, name: p.name, code: p.code, qty: it.qty, unitPrice: round2(it.unitPrice), defaultPrice: p.salePrice, costPrice: p.costPrice });
    }

    const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
    const discount = Math.min(round2(b.discount), subtotal);
    const previousDue = customer.dueBalance;
    const grandTotal = round2(subtotal - discount + previousDue);
    const payable = Math.max(grandTotal, 0);
    const paid = Math.min(round2(b.paid), payable);
    const dueAfter = round2(grandTotal - paid);

    const sale = await Sale.create({
      invoiceNo: await nextInvoiceNo(),
      customer: customer._id,
      customerName: customer.name,
      customerAddress: order.address || customer.address || "",
      dsr: b.dsr,
      items: lines,
      subtotal,
      discount,
      previousDue,
      grandTotal,
      paid,
      dueAfter,
      type: dueAfter > 0 ? "due" : "instant",
      status: dueAfter <= 0 ? "paid" : paid <= 0 ? "due" : "partial",
      note: `Order ${order.orderNo}${order.note ? `: ${order.note}` : ""}`,
      payments: paid > 0 ? [{ at: new Date(), amount: paid }] : [],
      history: [{ at: new Date(), text: `Created from order ${order.orderNo}` }],
    });

    await Customer.updateOne({ _id: customer._id }, { $inc: { dueBalance: round2(subtotal - discount - paid) } });

    order.set("items", lines.map((l) => ({ product: l.product, name: l.name, code: l.code, qty: l.qty, unitPrice: l.unitPrice })));
    order.subtotal = subtotal;
    order.status = "confirmed";
    order.sale = sale._id;
    order.invoiceNo = sale.invoiceNo;
    order.decidedAt = new Date();
    await order.save();

    return NextResponse.json({ sale, orderNo: order.orderNo }, { status: 201 });
  } catch (e) {
    // put back any stock already taken
    await Promise.all(reserved.map((r) => Product.updateOne({ _id: r.id }, { $inc: { stock: r.qty } })));
    throw e;
  }
});
