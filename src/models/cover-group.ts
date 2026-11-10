import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One row of the cover sheet: a set of phone models that share the same cover,
 * and the shelf/location letter where that cover is kept.
 */
const CoverGroupSchema = new Schema(
  {
    location: { type: String, required: true, trim: true, uppercase: true },
    models: { type: [String], required: true },
  },
  { timestamps: true },
);
CoverGroupSchema.index({ location: 1 });

export type CoverGroupDoc = InferSchemaType<typeof CoverGroupSchema>;
export const CoverGroup: Model<CoverGroupDoc> =
  (models.CoverGroup as Model<CoverGroupDoc>) || model<CoverGroupDoc>("CoverGroup", CoverGroupSchema);
