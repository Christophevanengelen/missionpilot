import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionClaims } from "@/lib/auth/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await getSessionClaims();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center p-6"
    >
      <Card className="border-border/70 w-full max-w-sm shadow-floating">
        <CardHeader>
          <CardTitle>
            <h1 className="text-base leading-none font-semibold">
              Sign in to MissionPilot
            </h1>
          </CardTitle>
          <CardDescription>
            Private beta — accounts are provisioned by the administrator;
            sign-ups are disabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
