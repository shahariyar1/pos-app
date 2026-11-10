import { NextResponse } from "next/server";
import { withApi } from "@/lib/api-handler";
import { Customer } from "@/models/customer";
import { Order } from "@/models/order";

/** Orders from the customer portal. ?status=pending|confirmed|rejected|cancelled (default: all). */
export const GET = withApi(async (req) => {
  const status = req.nextUrl.searchParams.get("status");
  const filter = status && ["pending", "confirmed", "rejected", "cancelled"].includes(status) ? { status } : {};
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200).lean();

  const customerIds = [...new Set(orders.map((o) => (o.customer ? String(o.customer) : "")).filter(Boolean))];
  const customers = customerIds.length ? await Customer.find({ _id: { $in: customerIds } }).select("dueBalance").lean() : [];
  const dueById = new Map(customers.map((c) => [String(c._id), c.dueBalance]));

  return NextResponse.json({
    data: orders.map((o) => ({ ...o, due: o.customer ? (dueById.get(String(o.customer)) ?? 0) : null })),
  });
});
