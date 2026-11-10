import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { clearAttempts, tooManyAttempts } from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";
import { normalizePhone } from "@/lib/phone";
import { startSession } from "@/lib/session";
import { loginSchema } from "@/lib/validations";
import { Account } from "@/models/account";

/** Log in with the shop name or the phone number, plus the password. */
export const POST = withApi(async (req) => {
  const key = `login:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}`;
  if (tooManyAttempts(key)) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");

  const { id, password } = loginSchema.parse(await req.json());
  const phone = normalizePhone(id);
  const candidates = await Account.find({
    $or: [{ nameLower: id.replace(/\s+/g, " ").toLowerCase() }, ...(phone ? [{ phone }] : [])],
  }).limit(5);

  let account = null;
  for (const c of candidates) {
    if (await verifyPassword(password, c.passwordHash)) {
      account = c;
      break;
    }
  }
  if (!account) throw new HttpError(401, "Wrong shop name, phone or password");
  if (account.status === "blocked") throw new HttpError(403, "This account is blocked. Please contact the shop.");

  clearAttempts(key);
  account.lastLoginAt = new Date();
  await account.save();
  await startSession("customer", String(account._id));
  return NextResponse.json({ status: account.status });
}, "public");
