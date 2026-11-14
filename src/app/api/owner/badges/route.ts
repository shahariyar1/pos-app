import { NextResponse } from "next/server";
import { withApi } from "@/lib/api-handler";
import { Account } from "@/models/account";
import { Order } from "@/models/order";

/** Numbers for the red dots in the menu: orders to confirm, sign-ups to approve. */
export const GET = withApi(async () => {
  const [orders, registrations] = await Promise.all([Order.countDocuments({ status: "pending" }), Account.countDocuments({ status: "pending" })]);
  return NextResponse.json({ orders, registrations });
});
