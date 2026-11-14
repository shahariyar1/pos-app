import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { getSession } from "@/lib/session";
import { Account } from "@/models/account";

/** API: owner only. */
export async function requireOwner() {
  if (!(await getSession("owner"))) throw new HttpError(401, "Please log in as the owner");
}

/**
 * API: the logged-in customer account.
 * By default it must be approved. Pass { active: false } to let a waiting account through (e.g. to show its status).
 */
export async function requireAccount(opts: { active?: boolean } = {}) {
  const session = await getSession("customer");
  if (!session) throw new HttpError(401, "Please log in");
  await connectDB();
  const account = await Account.findById(session.sub);
  if (!account) throw new HttpError(401, "Please log in");
  if (account.status === "blocked") throw new HttpError(403, "This account is blocked. Please contact the shop.");
  if (opts.active !== false && account.status !== "active") throw new HttpError(403, "Your account is waiting for approval");
  return account;
}

/** Pages: send visitors to the right login. */
export async function ownerPage() {
  if (!(await getSession("owner"))) redirect("/owner-login");
}
export async function customerPage() {
  if (!(await getSession("customer"))) redirect("/login");
}
