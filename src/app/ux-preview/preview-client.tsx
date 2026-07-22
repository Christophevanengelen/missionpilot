"use client";

import { useState } from "react";
import { PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Thread } from "@/components/conversation/thread";
import { Composer } from "@/components/conversation/composer";
import { ContextSummary } from "@/components/context/context-summary";
import {
  mockThread,
  mockKnownFacts,
  mockProgress,
  previewStates,
  type PreviewState,
} from "@/lib/ux/mock-conversation";

const STATE_LABELS: Record<PreviewState, string> = {
  populated: "Peuplé",
  loading: "Chargement",
  empty: "Vide",
  error: "Erreur",
  offline: "Hors ligne",
};

/**
 * UX Preview harness — mock data only, no backend, no persistence, no network.
 * Lets a reviewer switch thread states and inspect the conversational surface,
 * cards, score, approval, responsive layout and both themes.
 */
export function PreviewClient() {
  const [state, setState] = useState<PreviewState>("populated");
  const [contextOpen, setContextOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-surface-raised sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight">MissionPilot</span>
          <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
            UX Preview · données fictives
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden"
            aria-expanded={contextOpen}
            aria-controls="ux-context"
            onClick={() => setContextOpen((v) => !v)}
          >
            <PanelRightOpen aria-hidden="true" /> Contexte
          </Button>
        </div>
      </header>

      {/* State switcher — a demo affordance, not part of the product UI. */}
      <div
        role="group"
        aria-label="État de la conversation (démonstration)"
        className="border-border flex flex-wrap gap-2 border-b px-4 py-2 sm:px-6"
      >
        {previewStates.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={s === state ? "default" : "ghost"}
            aria-pressed={s === state}
            onClick={() => setState(s)}
          >
            {STATE_LABELS[s]}
          </Button>
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-2xl flex-col gap-6"
        >
          {contextOpen ? (
            <div
              id="ux-context"
              className="border-border bg-card rounded-xl border p-4 lg:hidden"
            >
              <ContextSummary facts={mockKnownFacts} progress={mockProgress} />
            </div>
          ) : null}
          <Thread turns={mockThread} state={state} />
          <div className="sticky bottom-4">
            <Composer disabled={state === "offline"} />
          </div>
        </main>

        <aside
          aria-label="Panneau de contexte"
          className="border-border bg-surface-raised hidden h-fit w-72 shrink-0 rounded-xl border p-4 lg:block"
        >
          <ContextSummary facts={mockKnownFacts} progress={mockProgress} />
        </aside>
      </div>
    </div>
  );
}
