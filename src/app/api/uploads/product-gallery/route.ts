
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { withApi, HttpError } from "@/lib/api-handler";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const POST = withApi(async (req) => {
  const formData = await req.formData();
  const files = formData.getAll("images");

  if (files.length === 0 || files.some((file) => !(file instanceof File))) {
    throw new HttpError(400, "Please select at least one image");
  }

  if (files.length > 10) {
    throw new HttpError(400, "Maximum 10 images are allowed");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  for (const file of files as File[]) {
    if (!allowedTypes.includes(file.type)) {
      throw new HttpError(400, "Only JPG, PNG and WebP images are allowed");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new HttpError(400, "Each image must be under 5MB");
    }
  }

  const uploadedImages = await Promise.all(
    (files as File[]).map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());

      return new Promise<{ url: string; publicId: string }>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                folder: "pos-products/gallery",
                resource_type: "image",
              },
              (error, uploaded) => {
                if (error || !uploaded) {
                  reject(error || new Error("Image upload failed"));
                  return;
                }

                resolve({
                  url: uploaded.secure_url,
                  publicId: uploaded.public_id,
                });
              }
            )
            .end(buffer);
        }
      );
    })
  );

  return NextResponse.json({
    galleryImages: uploadedImages,
  });
});
