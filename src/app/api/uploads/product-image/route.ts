
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
  const file = formData.get("image");

  if (!(file instanceof File)) {
    throw new HttpError(400, "Please select an image");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    throw new HttpError(400, "Only JPG, PNG and WebP images are allowed");
  }

  if (file.size > 4 * 1024 * 1024) {
    throw new HttpError(400, "Image size must be under 4MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "pos-products",
          resource_type: "image",
        },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(error || new Error("Image upload failed"));
            return;
          }

          resolve({
            secure_url: uploaded.secure_url,
            public_id: uploaded.public_id,
          });
        },
      )
      .end(buffer);
  });

  return NextResponse.json({
    imageUrl: result.secure_url,
    publicId: result.public_id,
  });
});
