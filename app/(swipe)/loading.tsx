import { Skeleton } from "@/components/ui/primitives";

/** Loading skeleton shaped like the swipe deck. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-3 pb-3 pt-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="mx-1 h-8 w-48" />
      <Skeleton className="mt-3 min-h-[320px] flex-1 rounded-[24px]" />
      <div className="mt-3 flex justify-center gap-5">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="mt-2.5 h-11 w-11 rounded-full" />
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    </div>
  );
}
