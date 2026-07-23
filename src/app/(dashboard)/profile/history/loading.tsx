import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div
      role="status"
      aria-label="Chargement de l'historique"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
