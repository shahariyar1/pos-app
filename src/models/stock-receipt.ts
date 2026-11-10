import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * "These units arrived on this day." Only receipts are kept; what is left on the shelf is worked out
 * from them (oldest sold first), so the normal stock number never has to change how it works.
 */
const StockReceiptSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);
StockReceiptSchema.index({ product: 1, receivedAt: -1 });

export type StockReceiptDoc = InferSchemaType<typeof StockReceiptSchema>;
export const StockReceipt: Model<StockReceiptDoc> =
  (models.StockReceipt as Model<StockReceiptDoc>) || model<StockReceiptDoc>("StockReceipt", StockReceiptSchema);
