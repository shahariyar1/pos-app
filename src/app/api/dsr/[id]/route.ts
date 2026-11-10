import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { objectId } from "@/lib/validations";
import { Dsr } from "@/models/dsr";

type Ctx = { params: Promise<{ id: string }> };

/** Removes the name from the list. Memos already sold by this DSR keep the name. */
export const DELETE = withApi<Ctx>(async (_req, { params }) => {
  const id = objectId.parse((await params).id);
  const dsr = await Dsr.findByIdAndDelete(id);
  if (!dsr) throw new HttpError(404, "DSR not found");
  return NextResponse.json({ ok: true });
});
