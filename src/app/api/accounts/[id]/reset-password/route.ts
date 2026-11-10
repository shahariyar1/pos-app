import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { hashPassword } from "@/lib/passwords";
import { objectId, resetPasswordSchema } from "@/lib/validations";
import { Account } from "@/models/account";

type Ctx = { params: Promise<{ id: string }> };

/** For a customer who forgot their password: set a new one and tell them. */
export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const { password } = resetPasswordSchema.parse(await req.json());
  const account = await Account.findById(id);
  if (!account) throw new HttpError(404, "Account not found");
  account.passwordHash = await hashPassword(password);
  await account.save();
  return NextResponse.json({ ok: true });
});
