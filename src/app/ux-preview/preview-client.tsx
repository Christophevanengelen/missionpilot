"use client";

import { useState } from "react";
import { PanelRightOpen, SlidersHorizontal } from "lucide-react";
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
 * The demo scaffolding (state switcher) lives in a collapsed panel, clearly
 * separated from the product surface.
 */
export function PreviewClient() {
  const [state, setState] = useState<PreviewState>("populated");
  const [contextOpen, setContextOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-surface-raised sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight">MissionPilot</span>
          {/* Hidden below 400px: on very narrow screens the header keeps only
              the brand and the icon actions — nothing may overlap. */}
          <span className="border-border text-muted-foreground hidden shrink-0 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap min-[400px]:inline">
            UX Preview
            <span className="hidden sm:inline"> · données fictives</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-muted-foreground border-dashed"
            aria-label="Démo"
            aria-expanded={demoOpen}
            aria-controls={demoOpen ? "demo-panel" : undefined}
            onClick={() => setDemoOpen((v) => !v)}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span className="hidden sm:inline">Démo</span>
          </Button>
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="xl:hidden"
            aria-label="Contexte"
            aria-expanded={contextOpen}
            aria-controls="ux-context"
            onClick={() => setContextOpen((v) => !v)}
          >
            <PanelRightOpen aria-hidden="true" />
            <span className="hidden sm:inline">Contexte</span>
          </Button>
        </div>
      </header>

      {/* Demo scaffolding — collapsed by default, visually apart (dashed). */}
      {demoOpen ? (
        <div className="flex justify-end px-4 pt-3 sm:px-6">
          <div
            id="demo-panel"
            role="group"
            aria-label="Panneau de démonstration — états simulés"
            className="border-border flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-1.5"
          >
            <span className="text-muted-foreground px-1.5 text-xs">
              États simulés
            </span>
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
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-12 px-4 py-8 sm:px-6">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col"
        >
          {contextOpen ? (
            <div
              id="ux-context"
              className="border-border bg-surface-raised mb-6 rounded-xl border p-4 xl:hidden"
            >
              <ContextSummary facts={mockKnownFacts} progress={mockProgress} />
            </div>
          ) : null}
          <Thread turns={mockThread} state={state} />
          {/* Sticky composer: it occupies its own layout slot at the end of
              the column, so the last card always scrolls fully above it; the
              gradient only fades content passing underneath. */}
          <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-(--background) via-(--background)/95 to-transparent pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Composer disabled={state === "offline"} />
          </div>
        </main>

        <aside
          aria-label="Panneau de contexte"
          className="border-border/60 hidden h-fit w-72 shrink-0 border-l pl-6 xl:sticky xl:top-24 xl:block"
        >
          <ContextSummary facts={mockKnownFacts} progress={mockProgress} />
        </aside>
      </div>
    </div>
  );
}
