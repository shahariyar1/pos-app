import { Product } from "@/models/product";

/** Normalize group labels for comparison without changing their display casing. */
export function normalizeGroupName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

/**
 * Reuse the spelling of an existing group when the submitted value only differs
 * by capitalization or whitespace. New group names keep the user's casing.
 */
export async function resolveProductGroup(value: string | undefined) {
  const cleaned = (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const existing = await Product.distinct("group", { isActive: true });
  return existing.find((group) => normalizeGroupName(group) === normalizeGroupName(cleaned)) ?? cleaned;
}

/** Hide legacy duplicates such as "Power Bank" and "power bank" in group filters. */
export function uniqueGroupNames(values: string[]) {
  const byNormalizedName = new Map<string, string>();
  for (const value of values.filter(Boolean).sort((a, b) => a.localeCompare(b))) {
    const key = normalizeGroupName(value);
    if (key && !byNormalizedName.has(key)) byNormalizedName.set(key, value.trim().replace(/\s+/g, " "));
  }
  return [...byNormalizedName.values()].sort((a, b) => a.localeCompare(b));
}
