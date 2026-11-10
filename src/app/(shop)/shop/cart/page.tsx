import type { Metadata } from "next";
import { CartScreen } from "@/features/portal/cart-screen";

export const metadata: Metadata = { title: "Cart" };
export default function Page() {
  return <CartScreen />;
}
