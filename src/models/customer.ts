import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    /** Positive = customer owes the shop. Negative = shop owes customer (credit). */
    dueBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);
CustomerSchema.index({ dueBalance: 1 });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema>;
export const Customer: Model<CustomerDoc> =
  (models.Customer as Model<CustomerDoc>) || model<CustomerDoc>("Customer", CustomerSchema);
