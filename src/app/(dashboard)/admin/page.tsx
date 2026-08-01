import type { Metadata } from "next";
import { verifyAdmin } from "@/lib/auth/dal";
import { lireInstantane } from "@/lib/admin/collecte";
import {
  acquisitionParSemaine,
  entonnoir,
  recommandation,
  retention,
} from "@/lib/admin/metrics";

export const metadata: Metadata = {
  title: "Pilotage",
  // Une page d'administration n'a rien à faire dans un index, même protégée.
  robots: { index: false, follow: false },
};

/**
 * Le tableau de pilotage — AAARRR, sans surveiller personne.
 *
 * DEUX RÈGLES, et elles expliquent tout ce que cet écran ne fait pas.
 *
 * 1. **Des agrégats, jamais des individus.** Aucune adresse, aucun nom, aucune
 *    affirmation de parcours n'arrive jusqu'ici. On ne peut pas afficher ce
 *    qu'on n'a pas ramené — c'est plus solide qu'une discipline d'affichage.
 * 2. **Aucun chiffre inventé.** Les étapes que le produit ne mesure pas sont
 *    écrites comme non mesurées, pas remplies d'un zéro. Un zéro se lit comme
 *    un échec ; « pas de mécanique » se lit comme ce que c'est.
 *
 * Tout vient de données déjà en base pour des raisons fonctionnelles : dates
 * de création, dernière connexion, existence d'une affirmation confirmée.
 * Rien n'a été ajouté pour mesurer, donc la politique de confidentialité n'a
 * pas une ligne de plus à déclarer.
 */
export default async function AdminPage() {
  await verifyAdmin();
  const { pris, comptes, profils, complet } = await lireInstantane();

  const etapes = entonnoir(comptes, profils);
  const r = retention(comptes, pris);
  const semaines = acquisitionParSemaine(comptes);
  const reco = recommandation(profils);
  const maxSemaine = Math.max(1, ...semaines.map((s) => s.compte));

  return (
    /* Le repère existe pour UNE assertion : vérifier qu'aucune adresse ne
       s'affiche ici. Sans lui, le test ne peut viser que `body`, qui contient
       l'en-tête de l'application — et l'en-tête affiche l'adresse de la
       personne connectée, ce qui ferait échouer une garantie pourtant tenue. */
    <div
      data-testid="pilotage"
      className="mx-auto flex w-full max-w-3xl flex-col gap-10 py-4"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pilotage</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Tout ce que cet écran montre est déduit de données déjà enregistrées
          pour faire fonctionner le produit. Aucun traceur, aucun événement de
          navigation — et aucune donnée nominative ne remonte jusqu&apos;ici.
        </p>
      </header>

      {!complet ? (
        <p role="alert" className="text-destructive text-sm">
          Une lecture a échoué : les chiffres ci-dessous seraient faux, ils ne
          sont donc pas affichés comme une mesure.
        </p>
      ) : null}

      {/* ── ACQUISITION → ACTIVATION ─────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold tracking-wider uppercase">
          Acquisition &amp; activation
        </h2>
        <ol className="flex flex-col gap-2">
          {etapes.map((e) => (
            <li
              key={e.cle}
              className="border-border bg-card flex flex-col gap-1 rounded-lg border p-4"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium">{e.libelle}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums">
                    {e.compte}
                  </span>
                  {e.conversion !== null ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {e.conversion} % du palier précédent
                    </span>
                  ) : null}
                </span>
              </div>
              <p className="text-muted-foreground text-xs text-pretty">
                {e.definition}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── RÉTENTION ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold tracking-wider uppercase">
          Rétention
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { l: "Actifs à 7 jours", v: r.actifs7j },
            { l: "Actifs à 30 jours", v: r.actifs30j },
            { l: "Jamais revenus", v: r.jamaisRevenus },
          ].map((c) => (
            <div
              key={c.l}
              className="border-border bg-card flex flex-col gap-1 rounded-lg border p-4"
            >
              <span className="text-xl font-semibold tabular-nums">{c.v}</span>
              <span className="text-muted-foreground text-xs">{c.l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── ACQUISITION DANS LE TEMPS ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold tracking-wider uppercase">
          Comptes créés, par semaine
        </h2>
        {semaines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun compte enregistré pour l&apos;instant.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {semaines.map((s) => (
              <li key={s.semaine} className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground w-24 shrink-0 tabular-nums">
                  {s.semaine}
                </span>
                <span
                  aria-hidden
                  className="bg-primary h-2 rounded-sm"
                  style={{ width: `${(s.compte / maxSemaine) * 100}%` }}
                />
                <span className="tabular-nums">{s.compte}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── CE QUE LE PRODUIT NE MESURE PAS ──────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-wider uppercase">
          Recommandation &amp; revenu
        </h2>
        <div className="border-border flex flex-col gap-3 rounded-lg border border-dashed p-4">
          <p className="text-sm">
            <span className="font-medium tabular-nums">
              {reco.abonnesDigest}
            </span>{" "}
            <span className="text-muted-foreground">
              abonné{reco.abonnesDigest > 1 ? "s" : ""} au récapitulatif
              hebdomadaire — le seul signal d&apos;engagement volontaire que le
              produit enregistre.
            </span>
          </p>
          <p className="text-muted-foreground text-xs text-pretty">
            <strong className="text-foreground font-medium">
              Recommandation :
            </strong>{" "}
            aucune mécanique de parrainage n&apos;existe. Ce n&apos;est pas zéro
            recommandation, c&apos;est une absence de mesure — afficher « 0 »
            laisserait croire à un échec.
          </p>
          <p className="text-muted-foreground text-xs text-pretty">
            <strong className="text-foreground font-medium">Revenu :</strong> le
            produit est gratuit et sous licence AGPL. Il n&apos;y a rien à
            compter, et ce sera vrai jusqu&apos;au jour où ce ne le sera plus.
          </p>
          <p className="text-muted-foreground text-xs text-pretty">
            <strong className="text-foreground font-medium">
              Notoriété (le premier A) :
            </strong>{" "}
            elle se mesure sur le trafic, hors de cette base. Vercel Analytics
            et la Search Console la portent — les brancher ici demanderait un
            traceur, donc une ligne de plus dans la politique de
            confidentialité.
          </p>
        </div>
      </section>
    </div>
  );
}
