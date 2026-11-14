import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Money collected later against a customer's due. */
const PaymentSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String },
  },
  { timestamps: true },
);
PaymentSchema.index({ createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema>;
export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc>) || model<PaymentDoc>("Payment", PaymentSchema);
