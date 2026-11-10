"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, errorMessage, revalidate } from "@/lib/fetcher";
import { formatMoney } from "@/lib/utils";
import { customerFormSchema, paymentSchema, type CustomerFormValues, type PaymentFormValues } from "@/lib/validations";
import type { Customer } from "@/types";

/** Create a customer, or correct a name, phone or due balance. */
export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customer: Customer | null;
}) {
  const isEdit = !!customer;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { name: "", phone: "", address: "", dueBalance: 0 },
  });

  useEffect(() => {
    if (open) reset({ name: customer?.name ?? "", phone: customer?.phone ?? "", address: customer?.address ?? "", dueBalance: customer?.dueBalance ?? 0 });
  }, [open, customer, reset]);

  async function onSubmit(values: CustomerFormValues) {
    try {
      await api(isEdit ? `/api/customers/${customer!._id}` : "/api/customers", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(values),
      });
      toast.success(isEdit ? "Customer updated" : "Customer added");
      revalidate("/api/customers");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "To record money received, use Collect payment. Edit the due here only to correct a mistake." : "Set an opening due if they already owe you."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="c-name" error={errors.name?.message}>
            <Input id="c-name" autoFocus aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Phone" htmlFor="c-phone" error={errors.phone?.message}>
            <Input id="c-phone" type="tel" {...register("phone")} />
          </Field>
          <Field label="Address" htmlFor="c-address" error={errors.address?.message}>
            <Input id="c-address" autoComplete="off" {...register("address")} />
          </Field>
          <Field label="Current due" htmlFor="c-due" error={errors.dueBalance?.message}>
            <Input id="c-due" type="number" step="0.01" min="0" inputMode="decimal" {...register("dueBalance", { valueAsNumber: true })} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Record money received against an existing due. */
export function PaymentDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({ resolver: zodResolver(paymentSchema), defaultValues: { amount: 0, note: "" } });

  useEffect(() => {
    if (customer) reset({ amount: customer.dueBalance, note: "" });
  }, [customer, reset]);

  async function onSubmit(values: PaymentFormValues) {
    if (!customer) return;
    if (values.amount > customer.dueBalance) {
      setError("amount", { message: `Cannot exceed the due of ${formatMoney(customer.dueBalance)}` });
      return;
    }
    try {
      await api(`/api/customers/${customer._id}/payments`, { method: "POST", body: JSON.stringify(values) });
      toast.success(`${formatMoney(values.amount)} received from ${customer.name}`);
      revalidate("/api/");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Collect payment</DialogTitle>
          <DialogDescription>
            {customer?.name} owes {customer && formatMoney(customer.dueBalance)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Amount received" htmlFor="pay-amount" error={errors.amount?.message}>
            <Input id="pay-amount" type="number" step="0.01" min="0" inputMode="decimal" autoFocus {...register("amount", { valueAsNumber: true })} />
          </Field>
          <Field label="Note (optional)" htmlFor="pay-note" error={errors.note?.message}>
            <Input id="pay-note" {...register("note")} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
