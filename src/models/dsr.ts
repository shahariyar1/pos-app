import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** A salesperson (DSR). Memos store the DSR's name, so deleting a DSR never changes old memos. */
const DsrSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export type DsrDoc = InferSchemaType<typeof DsrSchema>;
export const Dsr: Model<DsrDoc> = (models.Dsr as Model<DsrDoc>) || model<DsrDoc>("Dsr", DsrSchema);
