import { NextResponse } from "next/server";
import { withApi, HttpError, parseDate, rx, type MongoFilter } from "@/lib/api-handler";
import { isUnlocked } from "@/lib/auth";
import { round2 } from "@/lib/utils";
import { checkoutSchema, objectId } from "@/lib/validations";
import { Customer } from "@/models/customer";
import { nextInvoiceNo } from "@/models/counter";
import { Product } from "@/models/product";
import { Sale } from "@/models/sale";

export const GET = withApi(async (req) => {
  const sp = req.nextUrl.searchParams;
  const filter: MongoFilter = {};

  const from = parseDate(sp.get("from"), "from");
  const to = parseDate(sp.get("to"), "to");
  if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const status = sp.get("status");
  if (status === "unpaid") filter.status = { $in: ["partial", "due"] };
  else if (status && ["paid", "partial", "due"].includes(status)) filter.status = status;

  const dsr = sp.get("dsr");
  if (dsr) filter.dsr = dsr;

  const customerId = sp.get("customerId");
  if (customerId) filter.customer = objectId.parse(customerId);

  const q = sp.get("q")?.trim();
  if (q) filter.$or = [{ invoiceNo: rx(q) }, { customerName: rx(q) }];

  const unlocked = await isUnlocked();
  const query = Sale.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(sp.get("limit")) || 500, 1000));
  if (!unlocked) query.select("-items.costPrice");

  const [data, total] = await Promise.all([query.lean(), Sale.countDocuments(filter)]);
  return NextResponse.json({ data, total, unlocked });
});

/**
 * Checkout. Stock was already reserved when each "+" was tapped (see /api/products/:id/stock),
 * so this only writes the memo and moves the customer's balance.
 * Everything money-related is recomputed here; the client's totals are never trusted.
 */
export const POST = withApi(async (req) => {
  const body = checkoutSchema.parse(await req.json());

  const ids = [...new Set(body.items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items = body.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw new HttpError(404, "A product on this memo no longer exists");
    return {
      product: p._id,
      name: p.name,
      code: p.code,
      qty: i.qty,
      unitPrice: round2(i.unitPrice),
      defaultPrice: p.salePrice,
      costPrice: p.costPrice,
    };
  });
  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.unitPrice, 0));

  // Resolve the customer; create on the fly when a new name is typed.
  let customer = body.customerId ? await Customer.findById(body.customerId).lean() : null;
  if (body.customerId && !customer) throw new HttpError(404, "Customer not found");
  if (!customer && body.customerName) {
    customer = await Customer.findOneAndUpdate(
      { nameLower: body.customerName.toLowerCase() },
      { $setOnInsert: { name: body.customerName, nameLower: body.customerName.toLowerCase(), dueBalance: 0, address: body.customerAddress } },
      { upsert: true, new: true },
    ).lean();
  }

  // remember the address on the customer so it is filled in next time
  if (customer && body.customerAddress && body.customerAddress !== (customer.address ?? "")) {
    await Customer.updateOne({ _id: customer._id }, { $set: { address: body.customerAddress } });
  }
  const address = body.customerAddress || customer?.address || "";

  const discount = Math.min(round2(body.discount), subtotal); // a discount can never be more than the goods
  const previousDue = customer?.dueBalance ?? 0;
  const grandTotal = round2(subtotal - discount + previousDue);
  const payable = Math.max(grandTotal, 0);
  const paid = body.type === "instant" ? payable : Math.min(round2(body.paid), payable);
  const dueAfter = round2(grandTotal - paid);

  if (dueAfter > 0 && !customer) throw new HttpError(400, "Enter a customer name to save a due sale");

  const status = dueAfter <= 0 ? "paid" : paid <= 0 ? "due" : "partial";
  const sale = await Sale.create({
    invoiceNo: await nextInvoiceNo(),
    customer: customer?._id,
    customerName: customer?.name ?? "Walk-in",
    customerAddress: address,
    dsr: body.dsr,
    payments: paid > 0 ? [{ at: new Date(), amount: paid }] : [],
    items,
    subtotal,
    discount,
    previousDue,
    grandTotal,
    paid,
    dueAfter,
    type: body.type,
    status,
    note: body.note,
  });

  // Delta update (not a overwrite) so concurrent memos for the same customer can't clobber each other.
  if (customer) {
    await Customer.updateOne({ _id: customer._id }, { $inc: { dueBalance: round2(subtotal - discount - paid) } });
  }

  return NextResponse.json(sale, { status: 201 });
});
