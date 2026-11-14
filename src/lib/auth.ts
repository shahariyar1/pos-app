import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Profit/cost gate. A correct PIN sets a short-lived, signed, httpOnly cookie.
 * Every API that returns cost or profit data checks isUnlocked() on the server,
 * so the numbers never reach the browser while locked.
 */
const COOKIE = "profit_unlock";
const TTL_SECONDS = 15 * 60;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
};
const sign = (exp: string) => createHmac("sha256", secret()).update(exp).digest("hex");

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export function verifyPin(pin: string) {
  const expected = process.env.PROFIT_PIN;
  return !!expected && safeEqual(pin, expected);
}

export async function grantUnlock() {
  const exp = String(Date.now() + TTL_SECONDS * 1000);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function revokeUnlock() {
  (await cookies()).delete(COOKIE);
}

export async function isUnlocked() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

/* Basic brute-force guard (per server instance). Use Redis/Upstash if you run many instances. */
const attempts = new Map<string, { count: number; resetAt: number }>();
export function tooManyAttempts(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 5;
}
export const clearAttempts = (key: string) => attempts.delete(key);
