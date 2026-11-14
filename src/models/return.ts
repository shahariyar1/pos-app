import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ReturnSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product" }, // optional: a return can be typed in by hand
    productName: { type: String, required: true },
    code: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "" },
    invoiceNo: { type: String },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // refund per unit
    costPrice: { type: Number, required: true, min: 0 },
    refundAmount: { type: Number, required: true, min: 0 },
    refundMode: { type: String, enum: ["cash", "credit"], required: true },
    restocked: { type: Boolean, default: true },
    /** Came back broken: not put back in stock, shown in Hot > Damage. */
    damaged: { type: Boolean, default: false },
    /** Effect on profit: refund minus the cost of goods that came back into stock. */
    profitImpact: { type: Number, required: true },
    reason: { type: String },
    /** true when recorded from a memo edit (already reflected in that memo's totals). */
    viaMemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
ReturnSchema.index({ createdAt: -1 });

export type ReturnDoc = InferSchemaType<typeof ReturnSchema>;
export const Return: Model<ReturnDoc> =
  (models.Return as Model<ReturnDoc>) || model<ReturnDoc>("Return", ReturnSchema);
