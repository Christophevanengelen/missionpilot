import type { Metadata } from "next";
import { verifySession } from "@/lib/auth/dal";
import { PreviewClient } from "./preview-client";

export const metadata: Metadata = {
  title: "UX Preview",
  robots: { index: false, follow: false },
};

/**
 * Static, mock-only UX Preview of the conversational experience
 * (docs/ux/*). No backend, no persistence, no external service — a design
 * artifact to evaluate the foundation concretely. Auth-protected (DAL): an
 * internal demo that must never become public in a future deployment. NOT a
 * Phase 1 feature; its components (conversation/, cards/, context/) are
 * reusable.
 */
export default async function UxPreviewPage() {
  await verifySession();
  return <PreviewClient />;
}
