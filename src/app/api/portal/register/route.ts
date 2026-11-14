import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { tooManyAttempts } from "@/lib/auth";
import { hashPassword } from "@/lib/passwords";
import { normalizePhone } from "@/lib/phone";
import { registerSchema } from "@/lib/validations";
import { Account } from "@/models/account";

/** A shop signs up. The account waits for the owner's approval, which keeps spam and strangers out. */
export const POST = withApi(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooManyAttempts(`register:${ip}`)) throw new HttpError(429, "Too many sign-ups from this connection. Try again later.");

  const b = registerSchema.parse(await req.json());
  const shopName = b.shopName.replace(/\s+/g, " ");
  const nameLower = shopName.toLowerCase();
  if (await Account.exists({ nameLower })) {
    throw new HttpError(409, "This shop name is already registered. Try logging in, or ask the shop to reset your password.");
  }

  await Account.create({
    shopName,
    nameLower,
    address: b.address,
    phone: b.phone ? (normalizePhone(b.phone) ?? "") : "",
    passwordHash: await hashPassword(b.password),
    status: "pending",
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}, "public");
