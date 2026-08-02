import type { Metadata } from "next";
import { verifyAdmin } from "@/lib/auth/dal";
import { lireInstantane } from "@/lib/admin/collecte";
import {
  acquisitionParSemaine,
  entonnoir,
  qualite,
  recommandation,
  retention,
} from "@/lib/admin/metrics";

/** Les motifs, en français. Le pilotage lit des mots, pas des clés. */
const MOTIF_LISIBLE: Record<string, string> = {
  wrong_role: "Pas le bon métier",
  too_junior: "Trop junior",
  too_senior: "Trop senior",
  wrong_place: "Mauvais endroit",
  wrong_contract: "Mauvais contrat",
};

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
 * Presque tout vient de données déjà en base pour des raisons fonctionnelles :
 * dates de création, dernière connexion, existence d'une affirmation
 * confirmée.
 *
 * UNE EXCEPTION, ET ELLE EST ASSUMÉE. Les motifs d'écartement
 * (`offer_dismissals`) ont été ajoutés le 2026-08-01 — pour corriger la
 * recherche de la personne d'abord, pour mesurer ensuite. C'est donc bien une
 * donnée nouvelle, et la politique de confidentialité a gagné une ligne le
 * jour même. Elle y dit ce que la table contient : un compteur par motif, et
 * aucune référence à une offre.
 *
 * Ce n'est pas un traceur pour autant : la personne DÉCLARE ce qui ne va pas,
 * on n'observe pas ce qu'elle fait. La distinction est ce qui permet d'avoir
 * un signal de qualité sans changer la nature du produit.
 */
export default async function AdminPage() {
  await verifyAdmin();
  const { pris, comptes, profils, ecartements, complet } =
    await lireInstantane();

  const etapes = entonnoir(comptes, profils);
  const r = retention(comptes, pris);
  const semaines = acquisitionParSemaine(comptes);
  const reco = recommandation(profils);
  const q = qualite(ecartements);
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

      {/* ── LA QUALITÉ, avant la rétention ───────────────────────────────── */}
      {/* Placée AVANT la rétention, et c'est l'ordre qui porte l'argument :
          la rétention dit QUE les gens partent, celle-ci dit POURQUOI. Lire la
          seconde après avoir médité la première, c'est passer une réunion à
          s'inquiéter d'un chiffre dont la cause était deux écrans plus bas. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold tracking-wider uppercase">
          Est-ce que les offres sont bonnes ?
        </h2>
        {q.total === 0 ? (
          <p className="text-muted-foreground text-sm text-pretty">
            Personne n&apos;a encore écarté d&apos;offre. Ce n&apos;est pas un
            bon signe — c&apos;est une absence de signe : tant que ce chiffre
            est à zéro, rien ne dit si le moteur vise juste.
          </p>
        ) : (
          <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-sm">
              <span className="text-xl font-semibold tabular-nums">
                {q.total}
              </span>{" "}
              <span className="text-muted-foreground">
                offre{q.total > 1 ? "s" : ""} écartée{q.total > 1 ? "s" : ""},
                avec un motif choisi par la personne — jamais observé.
              </span>
            </p>
            <ul className="flex flex-col gap-1">
              {q.parMotif.map((m) => (
                <li key={m.motif} className="flex items-center gap-3 text-xs">
                  <span className="w-44 shrink-0">
                    {MOTIF_LISIBLE[m.motif]}
                  </span>
                  <span
                    aria-hidden
                    className="bg-primary h-2 rounded-sm"
                    style={{
                      width: `${(m.compte / q.parMotif[0].compte) * 100}%`,
                    }}
                  />
                  <span className="tabular-nums">{m.compte}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs text-pretty">
              {q.reglageEnCause === null ? (
                <>
                  Aucun réglage ne ressort — les motifs se répartissent trop
                  également pour désigner un coupable. Désigner quand même
                  serait inventer.
                </>
              ) : (
                <>
                  <strong className="text-foreground font-medium">
                    Le réglage le plus souvent mis en cause :
                  </strong>{" "}
                  {q.reglageEnCause}.
                </>
              )}
            </p>
          </div>
        )}
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
