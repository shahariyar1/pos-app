import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { clearAttempts, tooManyAttempts } from "@/lib/auth";
import { startSession } from "@/lib/session";
import { ownerLoginSchema } from "@/lib/validations";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Owner login. The password comes from the OWNER_PASSWORD setting. */
export const POST = withApi(async (req) => {
  const expected = process.env.OWNER_PASSWORD;
  if (!expected) throw new HttpError(500, "OWNER_PASSWORD is not set on the server. Add it to your settings first.");

  const key = `owner:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}`;
  if (tooManyAttempts(key)) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");

  const { password } = ownerLoginSchema.parse(await req.json());
  if (!timingSafeEqual(digest(password), digest(expected))) throw new HttpError(401, "Wrong password");

  clearAttempts(key);
  await startSession("owner", "owner");
  return NextResponse.json({ ok: true });
}, "public");
