import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifySession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  await verifySession();

  return (
    <section aria-labelledby="dashboard-title" className="flex flex-col gap-6">
      <h1 id="dashboard-title" className="text-2xl font-semibold">
        Dashboard
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Nothing to review yet</CardTitle>
          <CardDescription>
            Phase 0 shell — opportunity intake, matching and application
            workspaces arrive in the next phases. System diagnostics will appear
            under Runs &amp; Quality.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No opportunities, applications or workflow runs exist for this
            account.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
