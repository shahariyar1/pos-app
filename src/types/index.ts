export type Product = {
  _id: string;
  name: string;
  code: string;
  location: string;
  group: string;
  warrantyDays?: number;
  /** Only present after the PIN unlock. */
  costPrice?: number;
  salePrice: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  familyCode: string;
 compatibleModels: string[];
};
export type ProductsResponse = { data: Product[]; total: number; locations: string[]; groups: string[]; unlocked: boolean };

export type Customer = { _id: string; name: string; phone?: string; address?: string; dueBalance: number; createdAt: string };
export type CustomersResponse = { data: Customer[]; totalDue: number };

export type SaleItem = {
  product: string;
  name: string;
  code: string;
  qty: number;
  unitPrice: number;
  defaultPrice: number;
  costPrice?: number;
};
export type SaleStatus = "paid" | "partial" | "due";
export type Sale = {
  _id: string;
  invoiceNo: string;
  customer?: string;
  customerName: string;
  customerAddress?: string;
  dsr?: string;
  items: SaleItem[];
  subtotal: number;
  previousDue: number;
  grandTotal: number;
  paid: number;
  dueAfter: number;
  type: "instant" | "due";
  status: SaleStatus;
  note?: string;
  returnTotal?: number;
  discount?: number;
  history?: { at: string; text: string }[];
  createdAt: string;
};
export type SalesResponse = { data: Sale[]; total: number; unlocked: boolean };

export type ReturnRecord = {
  _id: string;
  productName: string;
  code: string;
  customerName: string;
  invoiceNo?: string;
  qty: number;
  unitPrice: number;
  refundAmount: number;
  refundMode: "cash" | "credit";
  restocked: boolean;
  profitImpact?: number;
  reason?: string;
  createdAt: string;
};
export type ReturnsResponse = { data: ReturnRecord[]; totalRefunded: number; unlocked: boolean };

export type DashboardStats = {
  revenue: number;
  collected: number;
  invoices: number;
  itemsSold: number;
  returnsTotal: number;
  returnsCount: number;
  outstandingDue: number;
  customersWithDue: number;
  unlocked: boolean;
  profit?: { gross: number; returnsImpact: number; net: number };
};

export type SearchResponse = {
  products: Pick<Product, "_id" | "name" | "code" | "location" | "stock" | "salePrice">[];
  customers: Pick<Customer, "_id" | "name" | "phone" | "dueBalance">[];
};

export type CoverGroup = {
  _id: string;
  location: string;
  models: string[];
  /** Models in this group that match the search (only when searching). */
  matches?: string[];
};
export type CoversResponse = {
  data: CoverGroup[];
  /** Every location letter with its number of groups, for the filter chips. */
  locations: { location: string; groups: number }[];
};

/** A memo plus how many of each product were already returned against it. */
export type SaleDetail = Sale & { returned: Record<string, number> };

export type DsrTotals = {
  /** Money actually received in the range (cash in, minus cash handed back). */
  paid: number;
  /** Value of the memos made in the range, after returns. */
  sold: number;
  /** Still unpaid on those memos. */
  due: number;
  memos: number;
};
export type Dsr = DsrTotals & { _id: string; name: string };
export type DsrResponse = { data: Dsr[]; all: DsrTotals };

export type HotRow = { productId: string; name: string; code: string; group: string; stock: number; qty: number; revenue: number; memos: number; lastSold: string | null; batches?: { qty: number; daysLeft: number }[] };
export type HotResponse = { data: HotRow[]; totalQty: number; totalRevenue: number };

export type SlowRow = { productId: string; name: string; code: string; group: string; location: string; stock: number; lastSold: string | null; totalSold: number; daysLeft: number | null };
export type SlowResponse = { data: SlowRow[]; total: number; stockUnits: number };

export type DamageRow = {
  id: string;
  productName: string;
  code: string;
  group: string;
  qty: number;
  /** What the customer got back for it. */
  refundAmount: number;
  /** What the broken goods cost you. Only present after the PIN unlock. */
  costValue?: number;
  invoiceNo: string;
  customerName: string;
  reason: string;
  createdAt: string;
};
export type DamageResponse = { data: DamageRow[]; totalQty: number; totalRefund: number; totalCost?: number; unlocked: boolean };

/* ---------- Customer portal ---------- */
export type PortalProduct = { _id: string; name: string; code: string; group: string; price: number; available: number; low: boolean };
export type PortalProducts = { data: PortalProduct[]; total: number; groups: string[]; regulars: PortalProduct[] };
export type PortalMe = { shopName: string; address: string; phone: string; status: "pending" | "active" | "blocked"; due: number | null };

export type OrderStatus = "pending" | "confirmed" | "rejected" | "cancelled";
export type PortalOrder = {
  _id: string;
  orderNo: string;
  items: { product: string; name: string; code: string; qty: number; unitPrice: number }[];
  subtotal: number;
  note?: string;
  status: OrderStatus;
  invoiceNo?: string;
  ownerNote?: string;
  createdAt: string;
  decidedAt?: string;
};
export type PortalMemo = {
  _id: string;
  invoiceNo: string;
  createdAt: string;
  items: { name: string; code: string; qty: number; unitPrice: number }[];
  subtotal: number;
  returnTotal?: number;
  discount?: number;
  previousDue: number;
  grandTotal: number;
  paid: number;
  dueAfter: number;
  status: SaleStatus;
};
export type PortalStatement = { due: number; memos: PortalMemo[]; payments: { _id: string; amount: number; note?: string; createdAt: string }[] };

/* ---------- Owner side of the portal ---------- */
export type OwnerOrder = PortalOrder & { shopName: string; address: string; phone: string; due: number | null; source?: "portal" | "counter"; dsr?: string };
export type OwnerAccount = {
  _id: string;
  shopName: string;
  address: string;
  phone: string;
  status: "pending" | "active" | "blocked";
  customerName: string | null;
  due: number | null;
  match: { _id: string; name: string; dueBalance: number } | null;
  createdAt: string;
  lastLoginAt?: string;
};

export type AllRow = {
  key: string;
  productId: string;
  name: string;
  code: string;
  group: string;
  location: string;
  /** Units in this row: all the stock, or just the units that arrived on one day (products with a warranty). */
  qty: number;
  /** Warranty days left for these units, or null when the product has no warranty. */
  daysLeft: number | null;
  sold: number;
  lastSold: string | null;
};
export type AllResponse = { data: AllRow[]; total: number; stockUnits: number; expiring: number };
