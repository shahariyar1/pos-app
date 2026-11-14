import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { objectId } from "@/lib/validations";
import { Account } from "@/models/account";

type Ctx = { params: Promise<{ id: string }> };

/** Remove a login (for example a rejected sign-up). The customer record, memos and due are not touched. */
export const DELETE = withApi<Ctx>(async (_req, { params }) => {
  const id = objectId.parse((await params).id);
  const account = await Account.findByIdAndDelete(id);
  if (!account) throw new HttpError(404, "Account not found");
  return NextResponse.json({ ok: true });
});
