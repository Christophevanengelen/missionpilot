import { verifySession } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

// Primary navigation from docs/UX_SPEC.md. Only routes that exist are links;
// the rest are announced as "coming soon" so the shell stays honest.
const NAV_ITEMS: Array<{ label: string; href: string | null }> = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Opportunities", href: null },
  { label: "Applications", href: null },
  { label: "Profil & Preuves", href: "/profile" },
  { label: "Runs & Quality", href: "/diagnostics" },
  { label: "Settings", href: null },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Defense in depth only — every page below re-verifies via the DAL
  // (layouts do not re-render on client-side navigation).
  const session = await verifySession();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border bg-surface-raised flex items-center justify-between gap-4 border-b px-6 py-3">
        <span className="font-semibold tracking-tight">MissionPilot</span>
        <div className="flex items-center gap-2">
          <span
            className="text-muted-foreground hidden text-sm sm:inline"
            data-testid="session-email"
          >
            {session.email ?? "Signed in"}
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <nav
          aria-label="Primary"
          className="border-border bg-surface-raised w-56 border-r p-4"
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <NavLink href={item.href}>{item.label}</NavLink>
                ) : (
                  <span
                    aria-disabled="true"
                    className="text-muted-foreground block cursor-not-allowed rounded-md px-3 py-2 text-sm"
                  >
                    {item.label}
                    <span className="sr-only"> (coming soon)</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" tabIndex={-1} className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
