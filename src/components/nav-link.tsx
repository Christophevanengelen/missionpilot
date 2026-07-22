"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Primary-nav link with an accessible active state (aria-current). */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

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
