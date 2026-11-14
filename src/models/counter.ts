import { Schema, model, models, type Model } from "mongoose";

type CounterDoc = { _id: string; seq: number };
const CounterSchema = new Schema<CounterDoc>({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) || model<CounterDoc>("Counter", CounterSchema);

/** Atomic, gap-free-ish invoice numbers: INV-000001 */
export async function nextInvoiceNo() {
  const c = await Counter.findByIdAndUpdate("invoice", { $inc: { seq: 1 } }, { upsert: true, new: true });
  if (!c) throw new Error("Could not allocate invoice number");
  return `INV-${String(c.seq).padStart(6, "0")}`;
}

export async function nextOrderNo() {
  const c = await Counter.findByIdAndUpdate("order", { $inc: { seq: 1 } }, { upsert: true, new: true });
  if (!c) throw new Error("Could not allocate order number");
  return `ORD-${String(c.seq).padStart(5, "0")}`;
}
