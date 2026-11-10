import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/features/portal/auth-screen";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Customer login" };

export default async function Page() {
  if (await getSession("customer")) redirect("/shop");
  return <AuthScreen />;
}
