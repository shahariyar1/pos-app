
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import { GROUPS } from "@/lib/groups";
import { api, errorMessage, revalidate } from "@/lib/fetcher";
import { productFormSchema, type ProductFormValues } from "@/lib/validations";
import type { Product } from "@/types";

const EMPTY: ProductFormValues = {
  name: "",
  code: "",
  location: "",
  group: "",
  familyCode: "",
  compatibleModels: [],
  costPrice: undefined,
  salePrice: 0,
  stock: 0,
  lowStockThreshold: 5,
  warrantyDays: 0,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  canEditCost: boolean;
};

export function ProductFormDialog({ open, onOpenChange, product, canEditCost }: Props) {
  const isEdit = !!product;
  const showCost = !isEdit || canEditCost;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues, unknown, ProductFormValues>({
  resolver: zodResolver(productFormSchema),
  defaultValues: EMPTY,
});

  const compatibleModels = watch("compatibleModels") ?? [];

  useEffect(() => {
    if (open) {
      reset(
        product
          ? {
              name: product.name,
              code: product.code,
              location: product.location,
              group: product.group ?? "",
              familyCode: product.familyCode ?? "",
              compatibleModels: product.compatibleModels ?? [],
              costPrice: product.costPrice,
              salePrice: product.salePrice,
              stock: product.stock,
              lowStockThreshold: product.lowStockThreshold,
              warrantyDays: product.warrantyDays ?? 0,
            }
          : EMPTY,
      );
    }
  }, [open, product, reset]);

  async function onSubmit(values: ProductFormValues) {
    if (!isEdit && values.costPrice === undefined) {
      setError("costPrice", { message: "Cost price is required" });
      return;
    }

    const models = (values.compatibleModels ?? [])
      .flatMap((value) => value.split(/[=\n,]+/))
      .map((value) => value.trim())
      .filter(Boolean);

    const payload = {
      ...values,
      familyCode: values.familyCode?.trim() ?? "",
      compatibleModels: [...new Set(models.map((m) => m.toLowerCase()))].map(
        (model) => models.find((m) => m.toLowerCase() === model)!
      ),
    };

    if (!showCost) delete (payload as Partial<typeof payload>).costPrice;

    try {
      await api(isEdit ? `/api/products/${product!._id}` : "/api/products", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      toast.success(isEdit ? "Product updated" : "Product added");
      revalidate("/api/products");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const num = { valueAsNumber: true } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Add one product with multiple compatible phone models.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor="p-name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="p-name" autoFocus {...register("name")} />
          </Field>

          <Field label="Code" htmlFor="p-code" error={errors.code?.message}>
            <Input id="p-code" {...register("code")} />
          </Field>

          <Field label="Group" htmlFor="p-group" error={errors.group?.message}>
            <Input id="p-group" list="group-options" {...register("group")} />
            <datalist id="group-options">
              {GROUPS.map((g) => <option key={g} value={g} />)}
            </datalist>
          </Field>

          <Field label="Location" htmlFor="p-loc" error={errors.location?.message}>
            <Input id="p-loc" {...register("location")} />
          </Field>

          <Field label="Family Code" htmlFor="p-family" error={errors.familyCode?.message} hint="Example: Y20">
            <Input id="p-family" placeholder="Y20" {...register("familyCode")} />
          </Field>

          <Field
            label="Compatible Models"
            htmlFor="p-models"
            className="sm:col-span-2"
            hint="Paste models separated by =, commas or new lines."
          >
            <textarea
              id="p-models"
              rows={7}
              value={compatibleModels.join("\n")}
              onChange={(e) =>
                setValue(
                  "compatibleModels",
                  e.target.value.split(/[=\n,]+/).map((m) => m.trim()).filter(Boolean),
                  { shouldDirty: true, shouldValidate: true }
                )
              }
              placeholder={"Vivo Y20\nVivo Y20G\nVivo Y21\niQOO Z3"}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>

          {showCost ? (
            <Field label="Cost price" htmlFor="p-cost" error={errors.costPrice?.message}>
              <Input id="p-cost" type="number" step="0.01" min="0" {...register("costPrice", num)} />
            </Field>
          ) : (
            <p className="self-end pb-2 text-sm text-muted-foreground">
              Cost price is hidden. Unlock on the Dashboard to edit it.
            </p>
          )}

          <Field label="Sale price" htmlFor="p-sale" error={errors.salePrice?.message}>
            <Input id="p-sale" type="number" step="0.01" min="0" {...register("salePrice", num)} />
          </Field>

          <Field label="Stock quantity" htmlFor="p-stock" error={errors.stock?.message}>
            <Input id="p-stock" type="number" step="1" min="0" {...register("stock", num)} />
          </Field>

          <Field label="Low stock at" htmlFor="p-low" error={errors.lowStockThreshold?.message}>
            <Input id="p-low" type="number" step="1" min="0" {...register("lowStockThreshold", num)} />
          </Field>

          <Field label="Warranty (days)" htmlFor="p-warranty" error={errors.warrantyDays?.message}>
            <Input id="p-warranty" type="number" step="1" min="0" {...register("warrantyDays", num)} />
          </Field>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
