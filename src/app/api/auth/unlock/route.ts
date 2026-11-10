import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { clearAttempts, grantUnlock, isUnlocked, revokeUnlock, tooManyAttempts, verifyPin } from "@/lib/auth";
import { unlockSchema } from "@/lib/validations";

export const GET = withApi(async () => NextResponse.json({ unlocked: await isUnlocked() }));

export const POST = withApi(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooManyAttempts(ip)) throw new HttpError(429, "Too many attempts. Try again in 15 minutes.");
  const { pin } = unlockSchema.parse(await req.json());
  if (!verifyPin(pin)) throw new HttpError(401, "Incorrect PIN");
  clearAttempts(ip);
  await grantUnlock();
  return NextResponse.json({ unlocked: true });
});

export const DELETE = withApi(async () => {
  await revokeUnlock();
  return NextResponse.json({ unlocked: false });
});
