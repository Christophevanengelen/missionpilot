import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center p-6"
    >
      <section className="flex max-w-xl flex-col items-start gap-4">
        <h1 className="text-3xl font-semibold">MissionPilot</h1>
        <p className="text-muted-foreground">
          AI-assisted opportunity intelligence for senior freelancers: discover,
          evaluate and prepare high-value remote work — with every decision
          under human supervision.
        </p>
        <p className="text-muted-foreground text-sm">
          Private beta. Accounts are provisioned by the administrator.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </section>
    </main>
  );
}
