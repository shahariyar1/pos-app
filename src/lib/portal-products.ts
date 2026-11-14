import { Product } from "@/models/product";

/**
 * The same product can sit on two shelves (two stock records with the same name, code, group and price).
 * Customers should see ONE item with the combined stock, so these helpers merge such records.
 */
export const SELECT = "name code group salePrice stock lowStockThreshold";

export type Lean = { _id: unknown; name: string; code: string; group?: string | null; salePrice: number; stock: number; lowStockThreshold?: number | null };
export type PortalView = { _id: string; name: string; code: string; group: string; price: number; available: number; low: boolean };

export const keyOf = (p: Pick<Lean, "name" | "code" | "group" | "salePrice">) =>
  `${p.name.toLowerCase()}|${p.code.toLowerCase()}|${(p.group ?? "").toLowerCase()}|${p.salePrice}`;

/** Filter for every active record that is "the same product" as p. Use with .collation() so case does not matter. */
export const siblingFilter = (p: Pick<Lean, "name" | "code" | "group" | "salePrice">) => ({
  isActive: true,
  name: p.name,
  code: p.code,
  salePrice: p.salePrice,
  ...(p.group ? { group: p.group } : { $or: [{ group: "" }, { group: { $exists: false } }] }),
});

export const COLLATION = { locale: "en", strength: 2 } as const;

export function toView(rep: Lean, members: Lean[]): PortalView {
  const available = members.reduce((n, m) => n + m.stock, 0);
  return {
    _id: String(rep._id),
    name: rep.name,
    code: rep.code,
    group: rep.group ?? "",
    price: rep.salePrice,
    available,
    low: available > 0 && available <= (rep.lowStockThreshold ?? 5),
  };
}

/** Merge duplicates in a list of products into one item each, sorted by name. */
export function mergeProducts(products: Lean[]): PortalView[] {
  const groups = new Map<string, Lean[]>();
  for (const p of products) {
    const k = keyOf(p);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups.values()]
    .map((members) => toView([...members].sort((a, b) => b.stock - a.stock)[0], members))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One view per requested id (the view keeps that id), with the stock of all its twins added up. Missing/inactive ids are left out. */
export async function viewsForIds(ids: string[]): Promise<PortalView[]> {
  const found = await Product.find({ _id: { $in: ids }, isActive: true }).select(SELECT).lean();
  const out: PortalView[] = [];
  for (const p of found) {
    const twins = await Product.find(siblingFilter(p)).collation(COLLATION).select(SELECT).lean();
    out.push(toView(p, twins.length ? twins : [p]));
  }
  return out;
}
