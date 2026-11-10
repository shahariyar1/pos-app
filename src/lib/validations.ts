
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const num = (min = 0) =>
  z.number({ error: "Enter a number" }).min(min, `Must be ${min} or more`);

const int = (min = 0) =>
  z.number({ error: "Enter a whole number" })
    .int("Whole numbers only")
    .min(min, `Must be ${min} or more`);

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/* ---------- Products ---------- */

export const productBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z.string().trim().min(1, "Code is required").max(80),

  // Master family code, e.g. Y20
  familyCode: z.string().trim().max(80).default(""),

  // Compatible phone models
  compatibleModels: z
    .array(z.string().trim().min(1).max(120))
    .max(300, "Maximum 300 compatible models")
    .default([]),

  location: z.string().trim().max(20),
  group: z.string().trim().max(40),
  warrantyDays: int(),
  costPrice: num(),
  salePrice: num(),
  stock: int(),
  lowStockThreshold: int(),
});

export const productCreateSchema = productBaseSchema.extend({
  location: z.string().trim().max(20).default(""),
  group: z.string().trim().max(40).default(""),
  familyCode: z.string().trim().max(80).default(""),
  compatibleModels: z
    .array(z.string().trim().min(1).max(120))
    .max(300)
    .default([]),
  warrantyDays: int().default(0),
  lowStockThreshold: int().default(5),
});

export const productUpdateSchema = productBaseSchema.partial();

/** Form schema: cost is optional because editing it is hidden until the PIN unlock. */
export const productFormSchema = productBaseSchema.extend({
  costPrice: num().optional(),
});

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;

export const stockAdjustSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0 && Math.abs(n) <= 1000, "Invalid quantity"),
});

/* ---------- Customers ---------- */

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(200),
  dueBalance: num(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const customerCreateSchema = customerFormSchema.extend({
  phone: z.string().trim().max(30).default(""),
  address: z.string().trim().max(200).default(""),
  dueBalance: num().default(0),
});

export const customerUpdateSchema = customerFormSchema.partial();

export const paymentSchema = z.object({
  amount: num().refine((v) => v > 0, "Amount must be greater than 0"),
  note: z.string().trim().max(200).optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

/* ---------- Checkout ---------- */

export const checkoutSchema = z.object({
  customerId: objectId.optional(),
  customerName: z.string().trim().max(120).default(""),
  customerAddress: z.string().trim().max(200).default(""),
  dsr: z.string().trim().max(60).default(""),
  discount: z.number().min(0).default(0),
  items: z
    .array(
      z.object({
        productId: objectId,
        qty: z.number().int().min(1),
        unitPrice: z.number().min(0, "Price cannot be negative"),
      }),
    )
    .min(1, "Memo is empty"),
  paid: z.number().min(0),
  type: z.enum(["instant", "due"]),
  note: z.string().trim().max(300).optional(),
});

/* ---------- Returns ---------- */

export const returnSchema = z
  .object({
    productId: z.string().regex(/^[a-f\d]{24}$/i, "Pick a product"),
    qty: int(1),
    unitPrice: num(),
    customerId: objectId.optional(),
    invoiceNo: z.string().trim().max(30).optional(),
    refundMode: z.enum(["cash", "credit"]),
    restock: z.boolean(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.refundMode !== "credit" || !!d.customerId, {
    message: "Pick a customer to credit",
    path: ["customerId"],
  });

export type ReturnFormValues = z.infer<typeof returnSchema>;

export const unlockSchema = z.object({
  pin: z.string().min(4).max(32),
});

/* ---------- Cover sheet ---------- */

export const coverFormSchema = z.object({
  location: z
    .string()
    .trim()
    .min(1, "Enter a location, e.g. A")
    .max(5, "Keep it short, e.g. A or B2"),
  models: z.string().trim().min(1, "Add at least one phone model"),
});

export type CoverFormValues = z.infer<typeof coverFormSchema>;

export const coverApiSchema = z.object({
  location: z.string().trim().min(1).max(5),
  models: z
    .array(z.string().trim().min(1).max(120))
    .min(1, "Add at least one phone model")
    .max(300),
});

export const coverImportSchema = z.object({
  costPrice: num(),
  salePrice: num(),
  stock: int(),
});

export type CoverImportValues = z.infer<typeof coverImportSchema>;

/* ---------- Memo edits and returns from a memo ---------- */

export const addToSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: objectId,
        qty: z.number().int().min(1),
        unitPrice: z.number().min(0, "Price cannot be negative"),
      }),
    )
    .min(1, "Add at least one product"),
  extraPaid: z.number().min(0).default(0),
});

export const returnFromSaleSchema = z
  .object({
    saleId: objectId,

    /** Items that are on this memo. */
    lines: z
      .array(z.object({ productId: objectId, qty: z.number().int().min(1) }))
      .default([]),

    /** Items that are NOT on this memo. */
    extra: z
      .array(
        z.object({
          productId: objectId,
          qty: z.number().int().min(1),
          unitPrice: z.number().min(0),
        }),
      )
      .default([]),

    refundMode: z.enum(["cash", "credit"]),
    restock: z.boolean(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.lines.length + d.extra.length > 0, {
    message: "Choose at least one item to return",
    path: ["lines"],
  });

/* ---------- File import ---------- */

export const inventoryImportSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        code: z.string().trim().min(1).max(80),
        location: z.string().trim().max(20),
        group: z.string().trim().max(40).default(""),
        costPrice: z.number().min(0),
        salePrice: z.number().min(0),
        stock: z.number().int().min(0),
      }),
    )
    .max(5000)
    .default([]),

  coverGroups: z
    .array(
      z.object({
        location: z.string().trim().min(1).max(5),
        models: z.array(z.string().trim().min(1).max(120)).min(1).max(300),
      }),
    )
    .max(1000)
    .default([]),

  existing: z.enum(["skip", "add_stock", "replace"]).default("skip"),
});

/* ---------- Full memo edit ---------- */

export const editSaleSchema = z.object({
  /** Existing memo lines. */
  lines: z
    .array(
      z.object({
        index: z.number().int().min(0),
        qty: z.number().int().min(0),
        unitPrice: z.number().min(0),
      }),
    )
    .default([]),

  /** New products added to the memo. */
  add: z
    .array(
      z.object({
        productId: objectId,
        qty: z.number().int().min(1),
        unitPrice: z.number().min(0),
      }),
    )
    .default([]),

  /** Returned items. */
  returns: z
    .array(
      z.object({
        productId: objectId.optional(),
        name: z.string().trim().min(1, "Give each returned item a name").max(120),
        code: z.string().trim().max(80).default(""),
        qty: z.number().int().min(1),
        unitPrice: z.number().min(0),
        restock: z.boolean().default(false),
        damaged: z.boolean().default(false),
      }),
    )
    .default([]),

  refundMode: z.enum(["credit", "cash"]).default("credit"),
  extraPaid: z.number().min(0).default(0),

  /** The memo's total discount in BDT. */
  discount: z.number().min(0).optional(),

  /** Change who sold it. */
  dsr: z.string().trim().max(60).optional(),
});

export const dsrSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
});

/* ---------- Customer portal ---------- */

const phoneField = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || normalizePhone(v) !== null,
    "Enter a mobile number like 01XXXXXXXXX",
  );

export const registerSchema = z.object({
  shopName: z.string().trim().min(2, "Enter your shop name").max(80),
  address: z.string().trim().min(3, "Enter your shop address").max(200),
  phone: phoneField.default(""),
  password: z.string().min(6, "Use at least 6 characters").max(100),
});

export const registerFormSchema = registerSchema
  .extend({ phone: phoneField, confirm: z.string() })
  .refine((d) => d.password === d.confirm, {
    message: "The two passwords do not match",
    path: ["confirm"],
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export const loginSchema = z.object({
  id: z.string().trim().min(1, "Enter your shop name or phone number").max(120),
  password: z.string().min(1, "Enter your password").max(100),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const ownerLoginSchema = z.object({
  password: z.string().min(1, "Enter the owner password").max(100),
});

export const profileFormSchema = z.object({
  phone: phoneField,
  address: z.string().trim().min(3, "Enter your shop address").max(200),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const profileSchema = profileFormSchema.partial();

export const placeOrderSchema = z.object({
  items: z
    .array(z.object({ productId: objectId, qty: z.number().int().min(1).max(999) }))
    .min(1, "Your cart is empty")
    .max(100),
  note: z.string().trim().max(300).default(""),
  phone: z.string().trim().max(30).default(""),
});

export const confirmOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: objectId,
        qty: z.number().int().min(1),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, "An order needs at least one item"),
  paid: z.number().min(0).default(0),
  dsr: z.string().trim().max(60).default(""),
  discount: z.number().min(0).default(0),
});

export const rejectOrderSchema = z.object({
  reason: z.string().trim().max(200).default(""),
});

export const approveAccountSchema = z.object({
  customerId: objectId.optional(),
});

export const accountStatusSchema = z.object({
  status: z.enum(["active", "blocked"]),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Use at least 6 characters").max(100),
});

/** "Save as order" at the counter. */
export const counterOrderSchema = z.object({
  customerId: objectId.optional(),
  customerName: z.string().trim().min(1, "Enter the customer's name").max(120),
  customerAddress: z.string().trim().max(200).default(""),
  dsr: z.string().trim().max(60).default(""),
  note: z.string().trim().max(300).default(""),
  items: z
    .array(
      z.object({
        productId: objectId,
        qty: z.number().int().min(1),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, "The memo is empty"),
});

/** Receive more stock of a product. */
export const receiveSchema = z.object({
  qty: int(1),
  receivedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .optional(),
});

export type ReceiveFormValues = z.infer<typeof receiveSchema>;
