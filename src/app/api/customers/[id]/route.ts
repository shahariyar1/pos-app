import { NextResponse } from "next/server";
import { withApi, HttpError, type MongoFilter } from "@/lib/api-handler";
import { customerUpdateSchema, objectId } from "@/lib/validations";
import { Customer } from "@/models/customer";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (_req, { params }) => {
  const customer = await Customer.findById(objectId.parse((await params).id)).lean();
  if (!customer) throw new HttpError(404, "Customer not found");
  return NextResponse.json(customer);
});

/** Manual correction of name, phone or due balance. Use /payments to record money received. */
export const PATCH = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const body = customerUpdateSchema.parse(await req.json());
  const update: MongoFilter = { ...body };
  if (body.name) update.nameLower = body.name.toLowerCase();
  const customer = await Customer.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!customer) throw new HttpError(404, "Customer not found");
  return NextResponse.json(customer);
});

/**
 * Delete a customer. Past memos and returns keep the customer's name, so history is not lost.
 * A customer with a balance needs ?force=true (the screen sends it after you confirm).
 */
export const DELETE = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const customer = await Customer.findById(id);
  if (!customer) throw new HttpError(404, "Customer not found");
  const force = req.nextUrl.searchParams.get("force") === "true";
  if (customer.dueBalance !== 0 && !force) {
    throw new HttpError(409, "This customer still has a balance. Confirm to delete anyway.");
  }
  await customer.deleteOne();
  return NextResponse.json({ ok: true });
});
