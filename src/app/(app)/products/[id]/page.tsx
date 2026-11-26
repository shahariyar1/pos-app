import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/product";
import { ProductGallery } from "@/features/inventory/product-gallery";
import { AddToMemoButton } from "@/features/pos/add-to-memo-button";
import { CompatibleModelsEditor } from "@/features/inventory/compatible-models-editor";

export const metadata: Metadata = {
    title: "Product Details",
};

function getYouTubeVideoId(value: string) {
    try {
        const url = new URL(value);

        if (url.hostname === "youtu.be") {
            return url.pathname.split("/")[1] ?? null;
        }

        if (
            ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
                url.hostname
            )
        ) {
            if (url.pathname === "/watch") {
                return url.searchParams.get("v");
            }

            const match = url.pathname.match(
                /^\/(shorts|embed)\/([^/?]+)/
            );

            return match?.[2] ?? null;
        }
    } catch {
        return null;
    }

    return null;
}

export default async function ProductDetailsPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ returnTo?: string }>;
}) {
    const { id } = await params;
    const { returnTo: requestedReturnTo } = await searchParams;
    const returnTo = requestedReturnTo?.startsWith("/pos") && !requestedReturnTo.startsWith("//")
        ? requestedReturnTo
        : "/pos";

    await connectDB();

    const product = await Product.findOne({
        _id: id,
        isActive: true,
    })
        .select("name code salePrice stock location group warrantyDays compatibleModels imageUrl imagePublicId galleryImages youtubeUrls")
        .lean();

    if (!product) notFound();

    const memoProduct = {
        _id: product._id.toString(),
        name: product.name,
        code: product.code,
        salePrice: Number(product.salePrice),
    };

    return (
        <div className="mx-auto max-w-5xl space-y-5">
            <div className="flex items-center gap-3">
                <Link
                    href={returnTo}
                    prefetch
                    className="flex size-10 items-center justify-center rounded-lg border hover:bg-muted"
                >
                    <ArrowLeft className="size-4" />
                </Link>

                <div>
                    <h1 className="text-xl font-semibold">{product.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        {product.code}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="overflow-hidden p-3">
                    <ProductGallery
                        name={product.name}
                        images={[
                            ...(product.imageUrl
                                ? [{
                                    url: product.imageUrl,
                                    publicId: product.imagePublicId ?? "",
                                }]
                                : []),
                            ...(product.galleryImages ?? []),
                        ]}
                    />
                </Card>

                <Card className="space-y-4 p-5">
                    <div>
                        <p className="text-sm text-muted-foreground">Sale Price</p>
                        <p className="text-2xl font-bold">
                            ৳{Number(product.salePrice).toLocaleString("en-BD")}
                        </p>
                    </div>

                    <Badge variant={product.stock > 0 ? "secondary" : "destructive"}>
                        {product.stock > 0
                            ? `${product.stock} in stock`
                            : "Out of stock"}
                    </Badge>

                    <AddToMemoButton product={memoProduct} stock={product.stock} />

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-muted-foreground">Code</p>
                            <p className="font-medium">{product.code}</p>
                        </div>

                        <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-medium">{product.location || "Not set"}</p>
                        </div>

                        <div>
                            <p className="text-muted-foreground">Group</p>
                            <p className="font-medium">{product.group || "Not set"}</p>
                        </div>

                        <div>
                            <p className="text-muted-foreground">Warranty</p>
                            <p className="font-medium">
                                {product.warrantyDays ?? 0} days
                            </p>
                        </div>
                    </div>

                    {true && (
                        <div>
                            <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Compatible Models</h2><CompatibleModelsEditor productId={product._id.toString()} initialModels={product.compatibleModels ?? []} /></div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(product.compatibleModels ?? []).map((model: string) => (
                                    <Badge key={model} variant="outline">
                                        {model}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {product.youtubeUrls?.length > 0 && (
                <Card className="p-4">
                    <h2 className="mb-4 text-lg font-semibold">
                        Product Videos
                    </h2>

                    <div className="grid gap-4 md:grid-cols-2">
                        {(product.youtubeUrls ?? []).map((url: string, index: number) => {
                            const videoId = getYouTubeVideoId(url);

                            if (!videoId) return null;

                            return (
                                <iframe
                                    key={`${videoId}-${index}`}
                                    src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                                    loading="lazy"
                                    title={`Product Video ${index + 1}`}
                                    className="aspect-video w-full rounded-lg"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    referrerPolicy="strict-origin-when-cross-origin"
                                />
                            );
                        })}
                    </div>
                </Card>
            )}
        </div>
    );
}
