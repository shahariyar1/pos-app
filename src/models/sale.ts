import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SaleItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // price actually charged (edited on the memo)
    defaultPrice: { type: Number, required: true, min: 0 }, // list price at the time of sale
    costPrice: { type: Number, required: true, min: 0 }, // snapshot, so later cost changes don't rewrite history
  },
  { _id: false },
);

/** Every time money was received (or handed back, as a negative amount) on this memo. */
const PaymentEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const SaleSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Walk-in" },
    customerAddress: { type: String, default: "" },
    /** Name of the DSR (salesperson) who sold it. */
    dsr: { type: String, default: "" },
    items: { type: [SaleItemSchema], required: true },
    subtotal: { type: Number, required: true }, // value of goods on this memo
    previousDue: { type: Number, default: 0 }, // balance carried in
    grandTotal: { type: Number, required: true }, // subtotal + previousDue
    paid: { type: Number, required: true, min: 0 },
    dueAfter: { type: Number, required: true }, // grandTotal - paid
    type: { type: String, enum: ["instant", "due"], required: true },
    status: { type: String, enum: ["paid", "partial", "due"], required: true },
    note: { type: String },
    /** Value of goods returned after the sale (already taken off grandTotal). */
    returnTotal: { type: Number, default: 0 },
    /** Money taken off the goods (a discount). Already subtracted from grandTotal. */
    discount: { type: Number, default: 0, min: 0 },
    payments: { type: [PaymentEntrySchema], default: [] },
    /** What was changed on this memo and when. */
    history: { type: [{ at: { type: Date, default: Date.now }, text: { type: String, required: true } }], default: [] },
  },
  { timestamps: true },
);
SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ status: 1, createdAt: -1 });
SaleSchema.index({ customer: 1, createdAt: -1 });
SaleSchema.index({ dsr: 1, createdAt: -1 });

export type SaleDoc = InferSchemaType<typeof SaleSchema>;
export const Sale: Model<SaleDoc> = (models.Sale as Model<SaleDoc>) || model<SaleDoc>("Sale", SaleSchema);
