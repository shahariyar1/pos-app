import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5" aria-label="Loading product details" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4 rounded-xl border p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-4 pt-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
