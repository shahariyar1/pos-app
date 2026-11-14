
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imagePublicId, setImagePublicId] = useState("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<
    { url: string; publicId: string; isNew?: boolean }[]
  >([]);
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([]);
  const [youtubeInput, setYoutubeInput] = useState("");
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

      // Product image
      setImageFile(null);
      setImagePreview(product?.imageUrl ?? "");
      setImagePublicId(product?.imagePublicId ?? "");

      // Product gallery
      setGalleryFiles([]);
      setGalleryPreviews(
        product?.galleryImages?.map((image) => ({
          url: image.url,
          publicId: image.publicId,
        })) ?? []
      );

      setYoutubeUrls(product?.youtubeUrls ?? []);
      setYoutubeInput("");

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

    try {
      let nextImageUrl = imagePreview ? (product?.imageUrl ?? "") : "";
      let nextImagePublicId = imagePreview ? imagePublicId : "";

      // Upload new image to Cloudinary
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);

        const uploadResponse = await fetch(
          "/api/uploads/product-image",
          {
            method: "POST",
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(uploadData?.error ?? "Image upload failed");
        }

        nextImageUrl = uploadData.imageUrl;
        nextImagePublicId = uploadData.publicId;
      }
      // Upload additional gallery images
      let uploadedGalleryImages = galleryPreviews
        .filter((image) => !image.isNew)
        .map(({ url, publicId }) => ({ url, publicId }));

      if (galleryFiles.length > 0) {
        const galleryFormData = new FormData();

        galleryFiles.forEach((file) => {
          galleryFormData.append("images", file);
        });

        const galleryResponse = await fetch(
          "/api/uploads/product-gallery",
          {
            method: "POST",
            body: galleryFormData,
          }
        );

        const galleryData = await galleryResponse.json();

        if (!galleryResponse.ok) {
          throw new Error(
            galleryData?.error ?? "Gallery image upload failed"
          );
        }

        uploadedGalleryImages = [
          ...uploadedGalleryImages,
          ...galleryData.galleryImages,
        ];
      }
      const payload = {
        ...values,
        familyCode: values.familyCode?.trim() ?? "",
        compatibleModels: [
          ...new Set(models.map((m) => m.toLowerCase())),
        ].map(
          (model) => models.find((m) => m.toLowerCase() === model)!
        ),
        imageUrl: nextImageUrl,
        imagePublicId: nextImagePublicId,
        galleryImages: uploadedGalleryImages,
          youtubeUrls: youtubeUrls,
      };

      if (!showCost) {
        delete (payload as Partial<typeof payload>).costPrice;
      }

      await api(
        isEdit ? `/api/products/${product!._id}` : "/api/products",
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

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

          <Field label="Product Image" htmlFor="p-image" className="sm:col-span-2">
            <div className="grid gap-3">
              <Input
                id="p-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("Image must be under 5MB");
                    e.target.value = "";
                    return;
                  }

                  setImageFile(file);
                  setImagePreview(URL.createObjectURL(file));
                }}
              />

              {imagePreview && (
                <div className="flex items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-24 w-24 rounded-lg border object-cover"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview("");
                      setImagePublicId("");
                    }}
                  >
                    Remove image
                  </Button>
                </div>
              )}
            </div>
          </Field>


          <Field label="Additional Product Photos" htmlFor="p-gallery" className="sm:col-span-2">
            <div className="grid gap-3">
              <Input
                id="p-gallery"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []);

                  if (galleryPreviews.length + selected.length > 10) {
                    toast.error("Maximum 10 additional images allowed");
                    e.target.value = "";
                    return;
                  }

                  if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
                    toast.error("Each image must be under 5MB");
                    e.target.value = "";
                    return;
                  }

                  if (
                    selected.some(
                      (file) =>
                        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                    )
                  ) {
                    toast.error("Only JPG, PNG and WebP images are allowed");
                    e.target.value = "";
                    return;
                  }

                  setGalleryFiles((prev) => [...prev, ...selected]);

                  setGalleryPreviews((prev) => [
                    ...prev,
                    ...selected.map((file) => ({
                      url: URL.createObjectURL(file),
                      publicId: "",
                      isNew: true,
                    })),
                  ]);

                  e.target.value = "";
                }}
              />

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {galleryPreviews.map((image, index) => (
                  <div key={`${image.publicId}-${index}`} className="relative">
                    <img
                      src={image.url}
                      alt={`Product gallery ${index + 1}`}
                      className="aspect-square w-full rounded-lg border object-cover"
                    />

                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute right-1 top-1 size-7"
                      onClick={() => {
                        if (image.isNew) {
                          const newIndex = galleryPreviews
                            .slice(0, index)
                            .filter((item) => item.isNew).length;

                          setGalleryFiles((prev) =>
                            prev.filter((_, i) => i !== newIndex)
                          );
                        }

                        setGalleryPreviews((prev) =>
                          prev.filter((_, i) => i !== index)
                        );
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Maximum 10 additional photos. Each image must be under 5MB.
              </p>
            </div>
          </Field>

          {/* YouTube Videos */}
          <div className="space-y-3">
            <Label>YouTube Videos (Maximum 10)</Label>

            <div className="flex gap-2">
              <Input
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                placeholder="Paste YouTube Watch or Shorts URL"
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  let videoId = "";

                  try {
                    const url = new URL(youtubeInput.trim());

                    if (url.hostname === "youtu.be") {
                      videoId = url.pathname.split("/")[1] ?? "";
                    } else if (
                      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
                        url.hostname
                      )
                    ) {
                      videoId =
                        url.searchParams.get("v") ??
                        url.pathname.match(/^\/(shorts|embed)\/([^/]+)/)?.[2] ??
                        "";
                    }
                  } catch {
                    videoId = "";
                  }

                  if (!videoId) {
                    alert("Please enter a valid YouTube URL");
                    return;
                  }

                  if (youtubeUrls.length >= 10) {
                    alert("Maximum 10 videos allowed");
                    return;
                  }

                  setYoutubeUrls((prev) => [...prev, youtubeInput.trim()]);
                  setYoutubeInput("");
                }}
              >
                Add
              </Button>
            </div>

            {youtubeUrls.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <p className="truncate text-sm">{url}</p>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setYoutubeUrls((prev) =>
                      prev.filter((_, i) => i !== index)
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
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
