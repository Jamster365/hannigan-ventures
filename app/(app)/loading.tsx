import { Skeleton } from "@/components/ui/primitives";

/** Loading skeleton shaped like the Home feed. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-52" />
      <div className="mt-5 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
      <Skeleton className="mt-7 h-6 w-44" />
      <div className="mt-3 flex gap-3 overflow-hidden">
        <Skeleton className="h-[340px] w-[85vw] max-w-[350px] shrink-0 rounded-[18px]" />
        <Skeleton className="h-[340px] w-[85vw] max-w-[350px] shrink-0 rounded-[18px]" />
      </div>
    </div>
  );
}
