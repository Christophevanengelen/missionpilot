import { Skeleton } from "@/components/ui/skeleton";

export default function DiagnosticsLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading diagnostics"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
