"use client";

import { useActionState, useEffect, useRef } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Disabled-while-pending drops keyboard focus to <body>; restore it when a
  // sign-in error is shown (focus restitution after an error).
  useEffect(() => {
    if (state.error && document.activeElement === document.body) {
      buttonRef.current?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="text-destructive text-sm font-medium"
        >
          {state.error}
        </p>
      ) : null}
      <Button ref={buttonRef} type="submit" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
