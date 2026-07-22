"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Light/dark toggle. No mounted-state effect: the icons swap purely via CSS
 * `dark:` visibility (hydration-safe), and the next theme is resolved inside
 * the click handler. The label is theme-agnostic so it never mismatches.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Basculer entre le mode clair et sombre"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden="true" className="hidden dark:block" />
      <Moon aria-hidden="true" className="block dark:hidden" />
    </Button>
  );
}
