import { verifySession } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The product is ONE screen.
 *
 * This shell used to carry eight destinations — a dashboard of metrics, an
 * inbox, a CRM pipeline, diagnostics — which made an opportunity engine read as
 * an administration console. The owner opened the URL and saw furniture, not a
 * promise.
 *
 * There are two places now: what the market has for you, and who you are. Every
 * other screen still exists at its route for when it is genuinely needed, but
 * none of them earns a permanent seat in front of someone who came to find work.
 */
const NAV_ITEMS: Array<{ label: string; href: string | null }> = [
  { label: "Mes opportunités", href: "/dashboard" },
  { label: "Mon profil", href: "/profile" },
];

// The linkable destinations, so each NavLink can defer to a more-specific
// nested route (only one link is aria-current="page" at a time).
const NAV_HREFS = NAV_ITEMS.map((i) => i.href).filter(
  (h): h is string => h !== null,
);

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
      <div className="flex flex-1 flex-col sm:flex-row">
        {/* Mobile (<sm): compact horizontal nav above the content — the fixed
            224px column left only 48px of text at 320px (real overflow).
            Same destinations, aria-current, keyboard and SR semantics. */}
        <nav
          aria-label="Primary"
          className="border-border bg-surface-raised w-full border-b p-2 sm:w-56 sm:border-r sm:border-b-0 sm:p-4"
        >
          <ul className="flex flex-row flex-wrap gap-1 sm:flex-col sm:flex-nowrap">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <NavLink href={item.href} siblingHrefs={NAV_HREFS}>
                    {item.label}
                  </NavLink>
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
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
