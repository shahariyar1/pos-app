import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** The front door: owners go to the counter, customers to the shop, everyone else to the customer login. */
export default async function Home() {
  if (await getSession("owner")) redirect("/pos");
  if (await getSession("customer")) redirect("/shop");
  redirect("/login");
}
