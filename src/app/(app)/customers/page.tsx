import type { Metadata } from "next";
import { CustomersScreen } from "@/features/customers/customers-screen";

export const metadata: Metadata = { title: "Customers" };
export default function Page() {
  return <CustomersScreen />;
}
