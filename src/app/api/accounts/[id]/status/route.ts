import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { accountStatusSchema, objectId } from "@/lib/validations";
import { Account } from "@/models/account";

type Ctx = { params: Promise<{ id: string }> };

/** Block a login, or let it back in. Blocking keeps the customer's memos and due. */
export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const { status } = accountStatusSchema.parse(await req.json());
  const account = await Account.findById(id);
  if (!account) throw new HttpError(404, "Account not found");
  if (status === "active" && !account.customer) throw new HttpError(409, "Approve this account first");
  account.status = status;
  await account.save();
  return NextResponse.json({ ok: true });
});
