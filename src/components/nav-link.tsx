"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Primary-nav link with an accessible active state (aria-current). */
export function NavLink({
  href,
  children,
  siblingHrefs = [],
}: {
  href: string;
  children: React.ReactNode;
  /** All nav hrefs, so a parent route can defer to a more-specific nested
   *  item — otherwise both would claim aria-current="page". */
  siblingHrefs?: string[];
}) {
  const pathname = usePathname();
  const matches = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  // Most-specific wins: this link is current only if no longer nav href also
  // matches the current path (avoids two aria-current links on nested routes).
  const active =
    matches(href) &&
    !siblingHrefs.some(
      (h) => h !== href && h.length > href.length && matches(h),
    );

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring block rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none motion-safe:transition-colors motion-safe:duration-(--duration-fast)",
        active
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
