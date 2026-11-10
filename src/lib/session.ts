import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Two separate logins: the owner and the customers. Each is a signed, httpOnly cookie.
 * The signature uses AUTH_SECRET, so a cookie cannot be forged or edited.
 */
export type Role = "owner" | "customer";
type Payload = { role: Role; sub: string; exp: number };

const COOKIE: Record<Role, string> = { owner: "owner_session", customer: "customer_session" };
const DAYS = 30;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
};
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

function encode(p: Payload) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined, role: Role): Payload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    return p.role === role && p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

export async function startSession(role: Role, sub: string) {
  (await cookies()).set(COOKIE[role], encode({ role, sub, exp: Date.now() + DAYS * 86_400_000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 86_400,
  });
}

export async function endSession(role: Role) {
  (await cookies()).delete(COOKIE[role]);
}

export async function getSession(role: Role) {
  return decode((await cookies()).get(COOKIE[role])?.value, role);
}
