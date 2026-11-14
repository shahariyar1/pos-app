import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { approveAccountSchema, objectId } from "@/lib/validations";
import { Account } from "@/models/account";
import { Customer } from "@/models/customer";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Approve a sign-up. Either link it to a customer you already have (so the shop sees its real due and history),
 * or create a new customer record.
 */
export const POST = withApi<Ctx>(async (req, { params }) => {
  const id = objectId.parse((await params).id);
  const { customerId } = approveAccountSchema.parse(await req.json());

  const account = await Account.findById(id);
  if (!account) throw new HttpError(404, "Account not found");
  if (account.status === "active" && account.customer) throw new HttpError(409, "This account is already approved");

  let customer;
  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer) throw new HttpError(404, "Customer not found");
    if (await Account.exists({ customer: customer._id, _id: { $ne: account._id } })) {
      throw new HttpError(409, `${customer.name} already has a login`);
    }
  } else {
    const same = await Customer.findOne({ nameLower: account.nameLower });
    if (same) throw new HttpError(409, `A customer called "${same.name}" already exists. Choose to link this login to them.`);
    customer = await Customer.create({
      name: account.shopName,
      nameLower: account.nameLower,
      phone: account.phone ?? "",
      address: account.address,
      dueBalance: 0,
    });
  }

  if (!customer.address) customer.address = account.address;
  if (!customer.phone && account.phone) customer.phone = account.phone;
  await customer.save();

  account.customer = customer._id;
  account.status = "active";
  await account.save();
  return NextResponse.json({ ok: true });
});
