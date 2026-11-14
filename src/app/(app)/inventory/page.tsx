import type { Metadata } from "next";
import { InventoryScreen } from "@/features/inventory/inventory-screen";

export const metadata: Metadata = { title: "Inventory" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  // key remounts the screen when the palette navigates here with a new ?q=
  return <InventoryScreen key={q ?? ""} initialQuery={q ?? ""} />;
}
