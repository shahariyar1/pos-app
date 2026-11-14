
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
    const file = formData.get("video");

    if (!(file instanceof File)) {
        throw new HttpError(400, "Please select a video");
    }

    if (file.type !== "video/mp4") {
        throw new HttpError(400, "Only MP4 videos are allowed");
    }

    if (file.size > 50 * 1024 * 1024) {
        throw new HttpError(400, "Video size must be under 50MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await new Promise<{
        secure_url: string;
        public_id: string;
    }>((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                {
                    folder: "pos-products/videos",
                    resource_type: "video",
                },
                (error, uploaded) => {
                    if (error || !uploaded) {
                        reject(error || new Error("Video upload failed"));
                        return;
                    }

                    resolve({
                        secure_url: uploaded.secure_url,
                        public_id: uploaded.public_id,
                    });
                }
            )
            .end(buffer);
    });

    return NextResponse.json({
        videoUrl: result.secure_url,
        videoPublicId: result.public_id,
    });
});
