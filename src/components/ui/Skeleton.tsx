import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer rounded-md bg-surface-sunken", className)}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card-surface space-y-3 p-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function SkeletonBoard() {
  return (
    <div className="flex gap-4 overflow-hidden px-6 py-5">
      {[0, 1, 2, 3].map((column) => (
        <div key={column} className="w-[288px] shrink-0 space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          {Array.from({ length: 3 - (column % 2) }).map((_, index) => (
            <div key={index} className="card-surface space-y-2.5 p-3">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
