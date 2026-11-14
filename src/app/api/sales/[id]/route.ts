import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { ensureLedger } from "@/lib/payments";
import { round2 } from "@/lib/utils";
import { editSaleSchema, objectId } from "@/lib/validations";
import { Customer } from "@/models/customer";
import { Product } from "@/models/product";
import { Return } from "@/models/return";
import { Sale } from "@/models/sale";

type Ctx = { params: Promise<{ id: string }> };

/** One memo, plus how many of each product were already returned against it. Cost prices are never included. */
export const GET = withApi<Ctx>(async (_req, { params }) => {
  const id = objectId.parse((await params).id);
  const sale = await Sale.findById(id).select("-items.costPrice").lean();
  if (!sale) throw new HttpError(404, "Memo not found");

  const agg = await Return.aggregate<{ _id: unknown; qty: number }>([
    { $match: { invoiceNo: sale.invoiceNo, product: { $exists: true } } },
    { $group: { _id: "$product", qty: { $sum: "$qty" } } },
  ]);
  const returned: Record<string, number> = {};
  for (const a of agg) returned[String(a._id)] = a.qty;

  return NextResponse.json({ ...sale, returned });
});

const money = (n: number) => String(round2(n));

/**
 * Edit a saved memo in one go:
 *  - reduce or remove lines (the items go back into stock) and fix prices,
 *  - add more products,
 *  - record items returned after the sale (optional, name / code / price typed by hand),
 *  - receive more money.
 * Totals are recomputed here. The customer's balance moves by the difference this memo makes.
 */
export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const b = editSaleSchema.parse(await req.json());

  const sale = await Sale.findById(id);
  if (!sale) throw new HttpError(404, "Memo not found");
  // The customer may have been deleted since this memo was made
  const customer = sale.customer ? await Customer.findById(sale.customer).lean() : null;

  if (b.dsr !== undefined && b.dsr !== (sale.dsr ?? "")) {
    sale.history.push({ at: new Date(), text: `Sold by: ${sale.dsr || "nobody"} → ${b.dsr || "nobody"}` });
    sale.dsr = b.dsr;
  }

  const oldReturnTotal = sale.returnTotal ?? 0;
  const oldDiscount = sale.discount ?? 0;
  const oldContribution = round2(sale.subtotal - oldDiscount - oldReturnTotal - sale.paid); // what this memo added to the customer's balance
  const notes: string[] = [];

  /* 1. existing lines: reduce / remove / reprice */
  const edits = new Map(b.lines.map((l) => [l.index, l]));
  const kept: { product: unknown; name: string; code: string; qty: number; unitPrice: number; defaultPrice: number; costPrice: number }[] = [];
  const stockBack: { id: string; qty: number }[] = [];
  sale.items.forEach((it, index) => {
    const e = edits.get(index);
    const qty = e ? e.qty : it.qty;
    const price = e ? round2(e.unitPrice) : it.unitPrice;
    if (qty > it.qty) {
      throw new HttpError(400, `${it.name}: you can only reduce the quantity here. Add the product again to sell more.`);
    }
    if (qty < it.qty) {
      stockBack.push({ id: String(it.product), qty: it.qty - qty });
      notes.push(qty === 0 ? `Removed ${it.qty} × ${it.name}` : `${it.name}: quantity ${it.qty} → ${qty}`);
    }
    if (qty > 0 && price !== it.unitPrice) notes.push(`${it.name}: price ${money(it.unitPrice)} → ${money(price)}`);
    if (qty > 0) {
      kept.push({ product: it.product, name: it.name, code: it.code, qty, unitPrice: price, defaultPrice: it.defaultPrice, costPrice: it.costPrice });
    }
  });

  if (kept.length + b.add.length === 0) {
    throw new HttpError(400, "A memo needs at least one item. Use Delete memo to remove the whole memo.");
  }

  /* 2. totals (no database writes yet) */
  const subtotal = round2(kept.reduce((s, l) => s + l.qty * l.unitPrice, 0) + b.add.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const newReturns = round2(b.returns.reduce((s, r) => s + r.qty * r.unitPrice, 0));
  const returnTotal = round2(oldReturnTotal + newReturns);
  const discount = Math.min(round2(b.discount ?? oldDiscount), subtotal); // never more than the goods
  if (discount !== oldDiscount) notes.push(`Discount: ${money(oldDiscount)} → ${money(discount)}`);
  const grandTotal = round2(subtotal - discount + sale.previousDue - returnTotal);

  let base = sale.paid;
  if (newReturns > 0 && b.refundMode === "cash") base = Math.max(0, round2(base - newReturns)); // cash handed back
  if (!customer) base = Math.min(base, Math.max(grandTotal, 0)); // walk-in: no credit possible, extra money was handed back
  const room = Math.max(round2(grandTotal - base), 0);
  const received = Math.min(round2(b.extraPaid), room);
  const paid = round2(base + received);
  const dueAfter = round2(grandTotal - paid);

  if (dueAfter > 0 && !customer) {
    throw new HttpError(400, "This memo has no customer, so it must be paid in full. Enter the full amount in Received now.");
  }
  const status = dueAfter <= 0 ? "paid" : paid <= 0 ? "due" : "partial";

  /* 3. returned items that point at a product */
  const returnIds = [...new Set(b.returns.map((r) => r.productId).filter(Boolean) as string[])];
  const returnProducts = returnIds.length ? await Product.find({ _id: { $in: returnIds } }).lean() : [];
  const productById = new Map(returnProducts.map((p) => [String(p._id), p]));
  for (const r of b.returns) {
    if (r.productId && !productById.has(r.productId)) throw new HttpError(404, `${r.name}: product not found`);
  }

  /* 4. reserve stock for added products (all or nothing) */
  const reserved: { id: string; qty: number }[] = [];
  const added: typeof kept = [];
  try {
    for (const item of b.add) {
      const p = await Product.findOneAndUpdate(
        { _id: item.productId, isActive: true, stock: { $gte: item.qty } },
        { $inc: { stock: -item.qty } },
        { new: true },
      );
      if (!p) throw new HttpError(409, "Not enough stock for one of the products you added");
      reserved.push({ id: item.productId, qty: item.qty });
      added.push({ product: p._id, name: p.name, code: p.code, qty: item.qty, unitPrice: round2(item.unitPrice), defaultPrice: p.salePrice, costPrice: p.costPrice });
      notes.push(`Added ${item.qty} × ${p.name}`);
    }

    if (received > 0) notes.push(`Received ${money(received)}`);
    for (const r of b.returns) notes.push(`Return: ${r.qty} × ${r.name} (${money(r.qty * r.unitPrice)})${r.damaged ? " · damaged" : ""}`);

    ensureLedger(sale); // memos made before payments were logged keep their old money on their original date
    const paidChange = round2(paid - sale.paid);
    if (paidChange !== 0) sale.payments.push({ at: new Date(), amount: paidChange });

    sale.set("items", [...kept, ...added]);
    sale.subtotal = subtotal;
    sale.returnTotal = returnTotal;
    sale.discount = discount;
    sale.grandTotal = grandTotal;
    sale.paid = paid;
    sale.dueAfter = dueAfter;
    sale.status = status;
    for (const text of notes) sale.history.push({ at: new Date(), text });
    await sale.save();
  } catch (e) {
    await Promise.all(reserved.map((r) => Product.updateOne({ _id: r.id }, { $inc: { stock: r.qty } })));
    throw e;
  }

  /* 5. side effects once the memo is saved */
  await Promise.all(stockBack.map((s) => Product.updateOne({ _id: s.id }, { $inc: { stock: s.qty } })));

  if (b.returns.length) {
    const docs = b.returns.map((r) => {
      const p = r.productId ? productById.get(r.productId) : undefined;
      const soldLine = r.productId ? sale.items.find((i) => String(i.product) === r.productId) : undefined;
      const cost = soldLine?.costPrice ?? p?.costPrice ?? 0;
      const refund = round2(r.qty * r.unitPrice);
      return {
        product: r.productId,
        productName: r.name,
        code: r.code || p?.code || "",
        customer: customer?._id,
        customerName: customer?.name ?? "",
        invoiceNo: sale.invoiceNo,
        qty: r.qty,
        unitPrice: round2(r.unitPrice),
        costPrice: cost,
        refundAmount: refund,
        refundMode: b.refundMode,
        restocked: !!r.productId && r.restock && !r.damaged,
        damaged: r.damaged,
        profitImpact: round2(refund - (r.productId && r.restock && !r.damaged ? cost * r.qty : 0)),
        reason: "Returned after sale",
        viaMemo: true,
      };
    });
    await Return.insertMany(docs);
    await Promise.all(
      b.returns
        .filter((r) => r.productId && r.restock && !r.damaged)
        .map((r) => Product.updateOne({ _id: r.productId }, { $inc: { stock: r.qty } })),
    );
  }

  if (customer) {
    const delta = round2(round2(subtotal - discount - returnTotal - paid) - oldContribution);
    if (delta !== 0) await Customer.updateOne({ _id: customer._id }, { $inc: { dueBalance: delta } });
  }

  return NextResponse.json(sale);
});

/**
 * Delete a memo. Items go back into stock (except those already restocked through a return),
 * the customer's balance is corrected, and the returns logged against this memo are removed.
 */
export const DELETE = withApi<Ctx>(async (_req, { params }) => {
  const id = objectId.parse((await params).id);
  const sale = await Sale.findById(id);
  if (!sale) throw new HttpError(404, "Memo not found");

  const returns = await Return.find({ invoiceNo: sale.invoiceNo }).lean();
  const restockedByReturns = new Map<string, number>();
  let legacyCredit = 0; // credits given by the older Returns screen: not part of the memo's own totals
  for (const r of returns) {
    if (r.restocked && r.product) restockedByReturns.set(String(r.product), (restockedByReturns.get(String(r.product)) ?? 0) + r.qty);
    if (!r.viaMemo && r.refundMode === "credit") legacyCredit += r.refundAmount;
  }

  const sold = new Map<string, number>();
  for (const i of sale.items) sold.set(String(i.product), (sold.get(String(i.product)) ?? 0) + i.qty);
  await Promise.all(
    [...sold].map(([pid, qty]) => {
      const back = Math.max(0, qty - (restockedByReturns.get(pid) ?? 0));
      return back > 0 ? Product.updateOne({ _id: pid }, { $inc: { stock: back } }) : Promise.resolve();
    }),
  );

  if (sale.customer) {
    const contribution = round2(sale.subtotal - (sale.discount ?? 0) - (sale.returnTotal ?? 0) - sale.paid);
    await Customer.updateOne({ _id: sale.customer }, { $inc: { dueBalance: round2(-contribution + legacyCredit) } });
  }

  await Return.deleteMany({ invoiceNo: sale.invoiceNo });
  await sale.deleteOne();
  return NextResponse.json({ ok: true });
});
