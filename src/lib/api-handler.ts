import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { connectDB } from "@/lib/db";
import { requireOwner } from "@/lib/guards";
import { HttpError } from "@/lib/http-error";

export { HttpError };

/**
 * Wraps a route handler: checks who is calling, connects to Mongo, and maps errors to clean JSON.
 * Every route is OWNER-ONLY unless it says otherwise. Customer-facing routes pass "public"
 * and must then check the customer themselves with requireAccount().
 */
export function withApi<C = unknown>(handler: (req: NextRequest, ctx: C) => Promise<NextResponse>, auth: "owner" | "public" = "owner") {
  return async (req: NextRequest, ctx: C) => {
    try {
      if (auth === "owner") await requireOwner();
      await connectDB();
      return await handler(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

function toErrorResponse(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }
  if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
    return NextResponse.json({ error: "A record with this code or name already exists" }, { status: 409 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const rx = (s: string) => new RegExp(escapeRegex(s), "i");

export function parseDate(value: string | null, name: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Invalid ${name} date`);
  return d;
}

/** Mongo filters are built dynamically; Mongoose validates them at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MongoFilter = Record<string, any>;
