
"use client";

import { useState } from "react";

type GalleryImage = {
  url: string;
  publicId: string;
};

export function ProductGallery({
  name,
  images,
}: {
  name: string;
  images: GalleryImage[];
}) {
  const [selectedImage, setSelectedImage] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground">
        No image available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <img
        src={images[selectedImage].url}
        alt={name}
        className="aspect-square w-full rounded-lg bg-muted object-contain"
      />

      <div className="grid grid-cols-4 gap-2">
        {images.map((image, index) => (
          <button
            key={`${image.publicId}-${index}`}
            type="button"
            onClick={() => setSelectedImage(index)}
            className={`overflow-hidden rounded-lg border-2 ${
              selectedImage === index
                ? "border-primary"
                : "border-transparent"
            }`}
          >
            <img
              src={image.url}
              alt={`${name} ${index + 1}`}
              className="aspect-square w-full bg-muted object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
