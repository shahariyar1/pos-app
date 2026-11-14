import type { Metadata } from "next";
import { HotScreen } from "@/features/hot/hot-screen";

export const metadata: Metadata = { title: "Hot" };
export default function Page() {
  return <HotScreen />;
}
