import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { withApi, HttpError } from "@/lib/api-handler";

export const runtime = "nodejs";

const ALLOWED_FOLDERS = new Set([
  "pos-products",
  "pos-products/gallery",
]);

export const POST = withApi(async (req) => {
  const { folder } = await req.json();

  if (typeof folder !== "string" || !ALLOWED_FOLDERS.has(folder)) {
    throw new HttpError(400, "Invalid upload folder");
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError(500, "Cloudinary is not configured on the server");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    apiSecret,
  );

  return NextResponse.json({
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature,
  });
});
