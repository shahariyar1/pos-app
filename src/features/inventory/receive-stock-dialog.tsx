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
import { todayStr } from "@/lib/utils";
import { receiveSchema, type ReceiveFormValues } from "@/lib/validations";
import type { Product } from "@/types";

/** New units arrived. For products with a warranty (displays), the warranty counts from the day they arrived. */
export function ReceiveStockDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReceiveFormValues>({ resolver: zodResolver(receiveSchema), defaultValues: { qty: 1 } });

  useEffect(() => {
    if (product) reset({ qty: 1, receivedOn: todayStr() });
  }, [product, reset]);

  const warranty = product?.warrantyDays ?? 0;
  const on = watch("receivedOn");
  const daysAgo = on ? Math.max(0, Math.round((Date.parse(todayStr()) - Date.parse(on)) / 86_400_000)) : 0;

  async function onSubmit(values: ReceiveFormValues) {
    if (!product) return;
    try {
      await api(`/api/products/${product._id}/receive`, { method: "POST", body: JSON.stringify(values) });
      toast.success(`${values.qty} added to ${product.name}`);
      revalidate("/api/");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            {product?.name} · {product?.code}. Now {product?.stock} in stock.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="How many arrived" htmlFor="rs-qty" error={errors.qty?.message}>
            <Input id="rs-qty" type="number" min="1" step="1" inputMode="numeric" autoFocus aria-invalid={!!errors.qty} {...register("qty", { valueAsNumber: true })} />
          </Field>
          <Field
            label="Arrived on"
            htmlFor="rs-on"
            error={errors.receivedOn?.message}
            hint={
              warranty > 0
                ? `Warranty ${warranty} days from this day: ${Math.max(warranty - daysAgo, 0)} days left today.`
                : "Pick an earlier day if they came a few days ago."
            }
          >
            <Input id="rs-on" type="date" max={todayStr()} {...register("receivedOn")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Add to stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
