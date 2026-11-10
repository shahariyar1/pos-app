import type { Metadata } from "next";
import { MyOrders } from "@/features/portal/my-orders";

export const metadata: Metadata = { title: "My orders" };
export default function Page() {
  return <MyOrders />;
}
