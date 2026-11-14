import type { Metadata } from "next";
import { Catalog } from "@/features/portal/catalog";

export const metadata: Metadata = { title: "Shop" };
export default function Page() {
  return <Catalog />;
}
