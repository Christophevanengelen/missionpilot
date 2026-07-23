import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div
      role="status"
      aria-label="Chargement de l'entretien"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-16 w-3/4" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}
