import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { requireAccount } from "@/lib/guards";
import { normalizePhone } from "@/lib/phone";
import { profileSchema } from "@/lib/validations";
import { Customer } from "@/models/customer";

async function snapshot(account: Awaited<ReturnType<typeof requireAccount>>) {
  const customer = account.customer ? await Customer.findById(account.customer).select("dueBalance").lean() : null;
  return {
    shopName: account.shopName,
    address: account.address,
    phone: account.phone ?? "",
    status: account.status,
    /** Positive = you owe the shop. Negative = credit in your favour. null = not linked yet. */
    due: customer ? customer.dueBalance : null,
  };
}

export const GET = withApi(async () => NextResponse.json(await snapshot(await requireAccount({ active: false }))), "public");

/** Change your own phone number or address. */
export const PATCH = withApi(async (req) => {
  const account = await requireAccount({ active: false });
  const b = profileSchema.parse(await req.json());
  if (b.phone !== undefined) {
    const phone = b.phone === "" ? "" : normalizePhone(b.phone);
    if (phone === null) throw new HttpError(400, "Enter a mobile number like 01XXXXXXXXX");
    account.phone = phone;
  }
  if (b.address !== undefined) account.address = b.address;
  await account.save();
  return NextResponse.json(await snapshot(account));
}, "public");
