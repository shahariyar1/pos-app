import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ReturnSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    code: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "" },
    invoiceNo: { type: String },
    /** Original salesperson, including returns of extra items not on the memo. */
    dsr: { type: String, default: "" },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    refundAmount: { type: Number, required: true, min: 0 },
    refundMode: { type: String, enum: ["cash", "credit"], required: true },
    restocked: { type: Boolean, default: true },
    damaged: { type: Boolean, default: false },
    profitImpact: { type: Number, required: true },
    reason: { type: String },
    viaMemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);
ReturnSchema.index({ createdAt: -1 });
ReturnSchema.index({ dsr: 1, createdAt: -1 });

export type ReturnDoc = InferSchemaType<typeof ReturnSchema>;
export const Return: Model<ReturnDoc> =
  (models.Return as Model<ReturnDoc>) || model<ReturnDoc>("Return", ReturnSchema);
