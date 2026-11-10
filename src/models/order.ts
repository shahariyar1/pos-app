import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    code: { type: String, default: "" },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // price when ordered; the owner can change it when confirming
  },
  { _id: false },
);

/** An order placed by a customer. Confirming it turns it into a memo (Sale). */
const OrderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    /** Where it came from: the customer portal, or saved at the counter ("goods not handed over yet"). */
    source: { type: String, enum: ["portal", "counter"], default: "portal" },
    account: { type: Schema.Types.ObjectId, ref: "Account" },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    shopName: { type: String, required: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    dsr: { type: String, default: "" },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    note: { type: String, default: "" },
    status: { type: String, enum: ["pending", "confirmed", "rejected", "cancelled"], default: "pending" },
    sale: { type: Schema.Types.ObjectId, ref: "Sale" },
    invoiceNo: { type: String },
    ownerNote: { type: String, default: "" },
    decidedAt: { type: Date },
  },
  { timestamps: true },
);
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ account: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof OrderSchema>;
export const Order: Model<OrderDoc> = (models.Order as Model<OrderDoc>) || model<OrderDoc>("Order", OrderSchema);
