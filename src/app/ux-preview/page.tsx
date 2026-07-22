import type { Metadata } from "next";
import { PreviewClient } from "./preview-client";

export const metadata: Metadata = {
  title: "UX Preview",
  robots: { index: false, follow: false },
};

/**
 * Static, mock-only UX Preview of the conversational experience
 * (docs/ux/*). No backend, no persistence, no external service, no auth —
 * a design artifact to evaluate the foundation concretely. NOT a Phase 1
 * feature; its components (conversation/, cards/, context/) are reusable.
 */
export default function UxPreviewPage() {
  return <PreviewClient />;
}
