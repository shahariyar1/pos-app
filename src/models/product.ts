
import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },

    // Master Family Code (e.g. Y20)
    familyCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    // All compatible phone models
    compatibleModels: {
      type: [String],
      default: [],
      set: (values: string[]) =>
        [...new Set(
          (values || [])
            .map((v) => v.trim())
            .filter(Boolean)
        )],
    },

    location: { type: String, trim: true, default: "" },

    /** Cover, Charger, Cable, Headphones ... */
    group: { type: String, trim: true, default: "" },

    costPrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },

    lowStockThreshold: { type: Number, min: 0, default: 5 },

    /** Warranty in days */
    warrantyDays: { type: Number, min: 0, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Existing indexes
ProductSchema.index(
  { code: 1, name: 1, location: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);

ProductSchema.index({ name: 1 });
ProductSchema.index({ location: 1 });
ProductSchema.index({ group: 1 });

// New search indexes
ProductSchema.index({ familyCode: 1 });
ProductSchema.index({ compatibleModels: 1 });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) ||
  model<ProductDoc>("Product", ProductSchema);
