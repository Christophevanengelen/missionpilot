import { Skeleton } from "@/components/ui/skeleton";

export default function PreferencesLoading() {
  return (
    <div
      role="status"
      aria-label="Chargement des préférences"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
