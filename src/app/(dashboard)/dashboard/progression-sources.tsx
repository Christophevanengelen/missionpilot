import { Suspense } from "react";
import type { ResultatSource } from "@/lib/discovery/par-source";
import type { DiscoveredAd } from "@/lib/discovery/adzuna";

/**
 * Ce que le système est en train de faire, pendant qu'il le fait.
 *
 * POURQUOI CET ÉCRAN EXISTE. Le tableau de bord met une vingtaine de secondes
 * à rassembler ce que huit plateformes ont à proposer. Pendant ce temps il ne
 * montrait qu'un en-tête et le mot « on cherche » — assez longtemps pour
 * qu'on le croie cassé. Il l'a été pris pour, le 2026-07-29.
 *
 * Or il ne se passait pas rien : il se passait beaucoup, et personne ne le
 * voyait. Le défaut n'était pas seulement la lenteur, c'était le silence.
 *
 * LA RÈGLE QUI TIENT CE COMPOSANT : il ne simule aucune progression. Chaque
 * ligne est une frontière `Suspense` distincte qui attend LA promesse de SA
 * plateforme ; elle passe de « interroge » à son résultat au moment exact où
 * cette plateforme répond. Une barre qui avancerait sur une minuterie
 * impressionnerait une fois, puis afficherait exactement la même chose le jour
 * où tout est en panne — ce qui était le cas ce soir-là, trois sources sur
 * quatre muettes. Ici, une plateforme qui échoue le dit.
 */

type Lancement = {
  nom: string;
  promesse: Promise<ResultatSource<DiscoveredAd>>;
};

function Puce({ etat }: { etat: "attente" | "ok" | "vide" | "panne" }) {
  const couleur =
    etat === "ok"
      ? "bg-success"
      : etat === "panne"
        ? "bg-destructive"
        : etat === "vide"
          ? "bg-muted-foreground/40"
          : "bg-muted-foreground/40 motion-safe:animate-pulse";
  return (
    <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${couleur}`} />
  );
}

function Ligne({
  nom,
  etat,
  detail,
}: {
  nom: string;
  etat: "attente" | "ok" | "vide" | "panne";
  detail: string;
}) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <Puce etat={etat} />
      <span className="text-foreground/80 font-medium">{nom}</span>
      <span
        className={
          etat === "panne" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {detail}
      </span>
    </li>
  );
}

/** Résolue : la ligne dit ce que la plateforme a réellement rendu. */
async function LigneResolue({ lancement }: { lancement: Lancement }) {
  const r = await lancement.promesse;

  // Tout a échoué : c'est une panne, et elle se dit. La confondre avec « aucun
  // résultat » ferait croire à quelqu'un que le marché n'a rien pour lui,
  // alors qu'on n'a simplement pas pu demander.
  if (r.echecs === r.tentatives && r.tentatives > 0) {
    return <Ligne nom={r.nom} etat="panne" detail="indisponible" />;
  }
  if (r.ads.length === 0) {
    return (
      <Ligne nom={r.nom} etat="vide" detail="rien pour vous aujourd'hui" />
    );
  }
  const partiel = r.echecs > 0 ? ` · ${r.echecs}/${r.tentatives} en échec` : "";
  return (
    <Ligne
      nom={r.nom}
      etat="ok"
      detail={`${r.ads.length} offre${r.ads.length > 1 ? "s" : ""}${partiel}`}
    />
  );
}

/**
 * `role="status"` et non `role="log"` : un lecteur d'écran annonce les
 * changements sans interrompre ce que la personne est en train de lire, et
 * l'ordre des lignes ne bouge jamais — seul leur contenu change.
 */
export function ProgressionSources({
  lancements,
}: {
  lancements: readonly Lancement[];
}) {
  if (lancements.length === 0) return null;
  return (
    <section
      role="status"
      aria-live="polite"
      className="border-border bg-card rounded-xl border p-4"
    >
      <p className="text-muted-foreground mb-2 text-xs">
        Les plateformes que nous interrogeons pour vous, en direct.
      </p>
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {lancements.map((l) => (
          <Suspense
            key={l.nom}
            fallback={<Ligne nom={l.nom} etat="attente" detail="interroge…" />}
          >
            <LigneResolue lancement={l} />
          </Suspense>
        ))}
      </ol>
    </section>
  );
}
