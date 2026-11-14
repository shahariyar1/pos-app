import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OwnerLogin } from "@/features/portal/owner-login";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Owner login" };

export default async function Page() {
  if (await getSession("owner")) redirect("/pos");
  return <OwnerLogin />;
}
