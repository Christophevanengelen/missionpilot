"use client";

import { useState } from "react";

/**
 * Latches the dashboard's face to its INITIAL server state for the whole
 * visit. A first-login user starts in the hero (CV upload); the CV import
 * fires `router.refresh()` to reflect the freshly confirmed claims, which
 * re-runs the server component with hasProfile now true. Without this latch
 * the page would flip to the status view mid-flow — showing a misleading
 * "0 offers, go import your CV" while discovery is still running, and
 * dropping keyboard focus as the CV subtree unmounts. Latched, the hero (and
 * the CV import's own success screen, which shows the live discovery result
 * and the "see my offers" CTA) stays put; the status view is reached on the
 * next visit, once the profile genuinely exists.
 *
 * Both slots are always server-rendered so a cold load in either state has
 * its markup ready; the client just picks one and never switches on its own.
 */
export function DashboardHome({
  initialHasProfile,
  hero,
  status,
}: {
  initialHasProfile: boolean;
  hero: React.ReactNode;
  status: React.ReactNode;
}) {
  const [showStatus] = useState(initialHasProfile);
  return <>{showStatus ? status : hero}</>;
}
