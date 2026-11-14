import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** A customer's login for the shop portal. It only works after the owner approves it. */
const AccountSchema = new Schema(
  {
    shopName: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true },
    address: { type: String, required: true, trim: true },
    /** Optional at sign-up, required to place an order. Stored as 01XXXXXXXXX. */
    phone: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["pending", "active", "blocked"], default: "pending" },
    /** The shop's customer record (memos, due balance). Set when the owner approves. */
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);
AccountSchema.index({ phone: 1 });
AccountSchema.index({ status: 1, createdAt: -1 });

export type AccountDoc = InferSchemaType<typeof AccountSchema>;
export const Account: Model<AccountDoc> = (models.Account as Model<AccountDoc>) || model<AccountDoc>("Account", AccountSchema);
