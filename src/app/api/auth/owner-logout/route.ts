import { NextResponse } from "next/server";
import { withApi } from "@/lib/api-handler";
import { endSession } from "@/lib/session";

export const POST = withApi(async () => {
  await endSession("owner");
  return NextResponse.json({ ok: true });
}, "public");
