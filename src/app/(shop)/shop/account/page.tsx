import type { Metadata } from "next";
import { MyAccount } from "@/features/portal/my-account";

export const metadata: Metadata = { title: "My account" };
export default function Page() {
  return <MyAccount />;
}
