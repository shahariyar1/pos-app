import type { Metadata } from "next";
import { PosScreen } from "@/features/pos/pos-screen";

export const metadata: Metadata = { title: "Sell" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  // key remounts the screen when the palette navigates here with a new ?q=
  return <PosScreen key={q ?? ""} initialQuery={q ?? ""} />;
}
