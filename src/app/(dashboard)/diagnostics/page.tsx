import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifySession } from "@/lib/auth/dal";
import { createClient } from "@/lib/db/server";
import { TriggerForm } from "./trigger-form";

export const metadata: Metadata = {
  title: "Runs & Quality",
};

// The user client runs as `authenticated`: RLS scopes every query to the
// session owner (proven by supabase/tests/rls_policies.test.sql).
export default async function DiagnosticsPage() {
  await verifySession();
  const supabase = await createClient();

  const [runs, health] = await Promise.all([
    supabase
      .from("agent_runs")
      .select(
        "id, workflow_name, workflow_version, status, correlation_id, started_at, finished_at, error_code, agent_steps (step_name, attempt, status, latency_ms, schema_valid, error)",
      )
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("system_health_results")
      .select("idempotency_key, db_ok, ai_mock_ok, checked_at")
      .order("checked_at", { ascending: false })
      .limit(10),
  ]);

  if (runs.error || health.error) {
    throw new Error("diagnostics query failed");
  }

  return (
    <section
      aria-labelledby="diagnostics-title"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 id="diagnostics-title" className="text-2xl font-semibold">
          Runs &amp; Quality
        </h1>
        <TriggerForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow runs</CardTitle>
          <CardDescription>
            Durable system-health executions for your account (traces are
            append-only; retries reuse steps instead of duplicating them).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.data.length === 0 ? (
            <p
              className="text-muted-foreground text-sm"
              data-testid="runs-empty"
            >
              No workflow runs yet. Trigger a health check to create the first
              one — locally this requires the Inngest dev server (
              <code>pnpm inngest:dev</code>).
            </p>
          ) : (
            <ul className="flex flex-col gap-4" data-testid="runs-list">
              {runs.data.map((run) => (
                <li
                  key={run.id}
                  className="border-border rounded-md border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {run.workflow_name} v{run.workflow_version}
                    </span>
                    <span
                      className="bg-accent rounded px-2 py-0.5 font-mono text-xs"
                      data-testid="run-status"
                    >
                      {run.status}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {run.correlation_id}
                    </span>
                    {run.error_code ? (
                      <span className="text-destructive text-xs font-medium">
                        {run.error_code}
                      </span>
                    ) : null}
                  </div>
                  <table className="mt-3 w-full text-left text-sm">
                    <caption className="sr-only">
                      Steps of run {run.correlation_id}
                    </caption>
                    <thead>
                      <tr className="text-muted-foreground">
                        <th scope="col" className="py-1 pr-4 font-medium">
                          Step
                        </th>
                        <th scope="col" className="py-1 pr-4 font-medium">
                          Attempt
                        </th>
                        <th scope="col" className="py-1 pr-4 font-medium">
                          Status
                        </th>
                        <th scope="col" className="py-1 pr-4 font-medium">
                          Latency
                        </th>
                        <th scope="col" className="py-1 font-medium">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.agent_steps.map((step) => (
                        <tr key={`${step.step_name}-${step.attempt}`}>
                          <td className="py-1 pr-4">{step.step_name}</td>
                          <td className="py-1 pr-4">{step.attempt}</td>
                          <td className="py-1 pr-4">{step.status}</td>
                          <td className="py-1 pr-4">
                            {step.latency_ms != null
                              ? `${step.latency_ms} ms`
                              : "—"}
                          </td>
                          <td className="py-1">{step.error ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Health results</CardTitle>
          <CardDescription>
            One row per idempotency key — replays and retries never create a
            second row (UNIQUE constraint, proven by tests/integration).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No results yet.</p>
          ) : (
            <ul
              className="flex flex-col gap-1 text-sm"
              data-testid="health-list"
            >
              {health.data.map((row) => (
                <li key={row.idempotency_key} className="flex gap-3">
                  <span className="font-mono text-xs">
                    {row.idempotency_key}
                  </span>
                  <span>{row.db_ok ? "db ok" : "db failed"}</span>
                  <span>{row.ai_mock_ok ? "ai ok" : "ai failed"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
