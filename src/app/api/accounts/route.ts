import { NextResponse } from "next/server";
import { withApi } from "@/lib/api-handler";
import { Account } from "@/models/account";
import { Customer } from "@/models/customer";

/** Customer logins. ?status=pending|active|blocked (default: all). Never returns passwords. */
export const GET = withApi(async (req) => {
  const status = req.nextUrl.searchParams.get("status");
  const filter = status && ["pending", "active", "blocked"].includes(status) ? { status } : {};
  const accounts = await Account.find(filter).select("-passwordHash").sort({ createdAt: -1 }).limit(300).lean();

  const linkedIds = accounts.map((a) => a.customer).filter(Boolean);
  const [linked, sameName, taken] = await Promise.all([
    linkedIds.length ? Customer.find({ _id: { $in: linkedIds } }).select("name dueBalance").lean() : [],
    // an existing customer with the same name as a waiting shop: the owner probably wants to link them
    Customer.find({ nameLower: { $in: accounts.filter((a) => a.status === "pending").map((a) => a.nameLower) } })
      .select("name nameLower dueBalance")
      .lean(),
    Account.find({ customer: { $exists: true } }).select("customer").lean(),
  ]);
  const linkedById = new Map(linked.map((c) => [String(c._id), c]));
  const takenIds = new Set(taken.map((t) => String(t.customer)));
  const matchByName = new Map(sameName.filter((c) => !takenIds.has(String(c._id))).map((c) => [c.nameLower, c]));

  return NextResponse.json({
    data: accounts.map((a) => {
      const c = a.customer ? linkedById.get(String(a.customer)) : undefined;
      const m = a.status === "pending" ? matchByName.get(a.nameLower) : undefined;
      return {
        ...a,
        customerName: c?.name ?? null,
        due: c?.dueBalance ?? null,
        match: m ? { _id: String(m._id), name: m.name, dueBalance: m.dueBalance } : null,
      };
    }),
  });
});
