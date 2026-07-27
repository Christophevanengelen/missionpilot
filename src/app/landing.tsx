import Link from "next/link";

/**
 * La page publique — la seule chose qu'on voit avant d'avoir un compte.
 *
 * Elle remplaçait une redirection vers un champ de mot de passe ; elle était
 * ensuite juste, mais muette : un empilement de paragraphes pour un produit
 * dont l'idée entière est une FORME. « Monter d'une marche » se montre, et
 * aucune capture d'une liste d'annonces ne dit pourquoi celle-ci diffère.
 *
 * D'où le parti pris : la carrière DESSINÉE COMME UNE ÉLÉVATION D'ARCHITECTE.
 * Le mot « marche » vient de ce vocabulaire, et le système de design du
 * produit — « Studio calme », dont la signature est le filet et non l'ombre —
 * est déjà celui d'un plan technique. Le concept et la maison s'accordent
 * au lieu de se plaquer l'un sur l'autre.
 *
 * Deux décisions du dessin portent du sens, pas du décor :
 *
 * **La marche suivante est en POINTILLÉ, et c'est le seul élément doré.**
 * Elle n'est pas construite. Le produit ne prétend jamais que ce poste est
 * déjà le vôtre — il dit que votre parcours permet de le défendre. Un trait
 * plein aurait menti à l'endroit exact où ce produit ne doit pas mentir.
 *
 * **Les polices sont celles du système, sans exception.** Le dépôt interdit
 * tout webfont (aucun fetch réseau au build ni au rendu). Le caractère vient
 * donc de l'échelle, du contraste, et de la MONO EN VOIX D'ANNOTATION —
 * comme les cotes d'un plan. Contrainte transformée en langage.
 *
 * Ce qui n'a pas bougé : la page mène toujours par le refus, et ne fait
 * toujours pas semblant qu'on puisse s'inscrire.
 */

/* Le plan encre est le seul plan inversé du produit, et il l'est dans les deux
   thèmes : c'est une feuille imprimée, pas une surface applicative. Ses valeurs
   sont donc littérales plutôt que tokenisées — un plan dont le contraste change
   avec le thème du visiteur est un plan dont on ne maîtrise plus la lisibilité. */
const INK = "bg-[oklch(0.155_0.025_265)] text-[oklch(0.97_0.005_85)]";
/* 0.84 et non 0.76 : à 0.76 le texte secondaire tombait à 4,34:1 sur l'encre,
   sous le seuil AA de 4,5 — mesuré par axe, pas estimé à l'œil. La valeur doit
   aussi tenir sur les cellules de refus, dont le fond est PLUS CLAIR que le
   plan et où le contraste est donc plus faible encore. */
const INK_MUTED = "text-[oklch(0.84_0.02_265)]";
const INK_RULE = "border-[oklch(0.97_0.005_85_/_14%)]";
const GOLD = "text-[oklch(0.84_0.13_82)]";

/** La voix d'annotation : mono, capitales, très espacée. Elle sert aux cotes,
 *  aux repères et aux étiquettes — jamais à une phrase qu'on doit lire. */
const LABEL =
  "font-mono text-[0.66rem] uppercase tracking-[0.18em] tabular-nums";

/**
 * L'élévation.
 *
 * Quatre marches construites au trait plein, une cinquième en pointillé. Les
 * étiquettes des contremarches nomment CE QUI A GRANDI — périmètre, équipes,
 * autonomie — parce que c'est exactement ce que l'IA lit dans un parcours ;
 * mettre des intitulés de poste aurait montré un CV, pas une lecture.
 *
 * `role="img"` avec un titre : le dessin porte l'idée principale de la page,
 * il ne peut pas être `aria-hidden`. Quelqu'un qui ne le voit pas doit
 * recevoir la même idée, pas un trou.
 */
function Elevation() {
  const rule = "oklch(0.97 0.005 85 / 14%)";
  const line = "oklch(0.97 0.005 85 / 82%)";
  const soft = "oklch(0.76 0.02 265)";
  const gold = "oklch(0.84 0.13 82)";
  const mono = "var(--font-mono)";

  return (
    <svg
      viewBox="0 0 1000 380"
      role="img"
      aria-labelledby="elevation-titre"
      className="h-auto w-full"
    >
      <title id="elevation-titre">
        Une carrière dessinée comme un escalier : quatre marches déjà
        construites, dont la dernière porte le repère « vous êtes ici », et
        au-dessus une marche tracée en pointillé, « la marche d’après ».
      </title>

      {/* La trame, calée sur les marches plutôt que sur un pas arbitraire :
          chaque horizontale EST le niveau d'une marche. Assez présente pour
          qu'on lise « plan », assez discrète pour qu'on ne la regarde jamais. */}
      <g stroke={rule} strokeWidth="1">
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={80 + i * 80}
            y1="54"
            x2={80 + i * 80}
            y2="330"
          />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="80"
            y1={90 + i * 48}
            x2="960"
            y2={90 + i * 48}
          />
        ))}
      </g>

      {/* Lignes de construction : chaque nez de marche retombe au sol. C'est la
          convention du dessin d'exécution, et ici elle dit une chose vraie —
          chaque marche repose sur la précédente. */}
      {/* Pas de ligne de construction sous la contremarche dorée : elle s'y
          superposait et on lisait deux traits au même endroit, ce qui brouille
          précisément le point que le dessin doit rendre net. */}
      <g stroke={rule} strokeWidth="1" strokeDasharray="3 5">
        {[250, 410, 570].map((x) => (
          <line key={x} x1={x} y1="330" x2={x} y2="74" />
        ))}
      </g>

      <line
        x1="60"
        y1="330"
        x2="960"
        y2="330"
        stroke={soft}
        strokeWidth="1.5"
      />

      {/* Le construit. Trait plein, dessiné du sol vers la droite. */}
      <polyline
        points="90,330 90,282 250,282 250,234 410,234 410,186 570,186 570,138 730,138"
        fill="none"
        stroke={line}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="1400"
        strokeDashoffset="0"
        className="motion-safe:animate-[landing-draw_1400ms_var(--ease-soft)_200ms_both]"
      />

      {/* Ce qui a grandi, en cote, à gauche de chaque contremarche. */}
      <g fill={soft} fontFamily={mono} fontSize="12" textAnchor="end">
        <text x="242" y="262">
          périmètre
        </text>
        <text x="402" y="214">
          équipes
        </text>
        <text x="562" y="166">
          autonomie
        </text>
      </g>

      {/* Le repère « vous êtes ici » : un point, pas une icône. */}
      <g className="motion-safe:animate-[landing-fade_500ms_var(--ease-soft)_1400ms_both]">
        <circle cx="650" cy="138" r="4.5" fill={line} />
        <text
          x="650"
          y="120"
          fill={line}
          fontFamily={mono}
          fontSize="12"
          letterSpacing="1.6"
          textAnchor="middle"
        >
          VOUS ÊTES ICI
        </text>
      </g>

      {/* La marche d'après. Pointillé : elle n'est pas construite. */}
      <g className="motion-safe:animate-[landing-fade_700ms_var(--ease-soft)_1700ms_both]">
        <polyline
          points="730,138 730,90 890,90"
          fill="none"
          stroke={gold}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="7 6"
        />
        <text
          x="810"
          y="72"
          fill={gold}
          fontFamily={mono}
          fontSize="12"
          letterSpacing="1.6"
          textAnchor="middle"
        >
          LA MARCHE D’APRÈS
        </text>

        {/* La cote de la montée : une seule marche, et on la mesure. */}
        <g stroke={gold} strokeWidth="1">
          <line x1="925" y1="90" x2="925" y2="138" />
          <line x1="919" y1="90" x2="931" y2="90" />
          <line x1="919" y1="138" x2="931" y2="138" />
        </g>
        <text x="938" y="118" fill={gold} fontFamily={mono} fontSize="13">
          +1
        </text>
      </g>

      <text
        x="80"
        y="358"
        fill={soft}
        fontFamily={mono}
        fontSize="11"
        letterSpacing="1.8"
      >
        PARCOURS
      </text>
    </svg>
  );
}

/**
 * La même élévation, redessinée pour un petit écran — pas la même mise à
 * l'échelle.
 *
 * Le dessin large tient dans 1000 unités ; rendu sur 342 px, ses annotations
 * tombaient à quatre pixels de haut, c'est-à-dire nulle part. Un dessin qui
 * porte l'argument principal ne peut pas être illisible sur l'écran où la
 * moitié des gens le verront. Celui-ci a donc trois marches au lieu de quatre,
 * un format portrait, et une typographie dimensionnée pour être lue.
 *
 * Le titre accessible porte un identifiant DISTINCT : les deux dessins
 * coexistent dans le DOM (l'un masqué en CSS), et deux `id` identiques
 * casseraient l'arbre d'accessibilité autant que la validation.
 */
function ElevationCompacte() {
  const rule = "oklch(0.97 0.005 85 / 14%)";
  const line = "oklch(0.97 0.005 85 / 82%)";
  const soft = "oklch(0.76 0.02 265)";
  const gold = "oklch(0.84 0.13 82)";
  const mono = "var(--font-mono)";

  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-labelledby="elevation-titre-compacte"
      className="h-auto w-full"
    >
      <title id="elevation-titre-compacte">
        Une carrière dessinée comme un escalier : trois marches déjà
        construites, dont la dernière porte le repère « vous êtes ici », et
        au-dessus une marche tracée en pointillé, « la marche d’après ».
      </title>

      <g stroke={rule} strokeWidth="1">
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={40 + i * 84}
            y1="70"
            x2={40 + i * 84}
            y2="340"
          />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="40"
            y1={92 + i * 62}
            x2="376"
            y2={92 + i * 62}
          />
        ))}
      </g>

      <g stroke={rule} strokeWidth="1" strokeDasharray="3 5">
        {[124, 208, 292].map((x) => (
          <line key={x} x1={x} y1="340" x2={x} y2="80" />
        ))}
      </g>

      <line
        x1="30"
        y1="340"
        x2="386"
        y2="340"
        stroke={soft}
        strokeWidth="1.5"
      />

      <polyline
        points="40,340 40,278 124,278 124,216 208,216 208,154 292,154"
        fill="none"
        stroke={line}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="1400"
        strokeDashoffset="0"
        className="motion-safe:animate-[landing-draw_1400ms_var(--ease-soft)_200ms_both]"
      />

      <g className="motion-safe:animate-[landing-fade_500ms_var(--ease-soft)_1400ms_both]">
        <circle cx="250" cy="154" r="5" fill={line} />
        {/* Ligne de rappel : le libellé a dû s'écarter du point pour ne rien
            chevaucher, et un repère qui flotte ne désigne plus rien. */}
        <line
          x1="207"
          y1="136"
          x2="243"
          y2="150"
          stroke={line}
          strokeWidth="1"
        />
        <text
          x="200"
          y="140"
          fill={line}
          fontFamily={mono}
          fontSize="14"
          letterSpacing="1.4"
          textAnchor="end"
        >
          VOUS ÊTES ICI
        </text>
      </g>

      <g className="motion-safe:animate-[landing-fade_700ms_var(--ease-soft)_1700ms_both]">
        <polyline
          points="292,154 292,92 376,92"
          fill="none"
          stroke={gold}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="7 6"
        />
        <text
          x="376"
          y="74"
          fill={gold}
          fontFamily={mono}
          fontSize="14"
          letterSpacing="1.4"
          textAnchor="end"
        >
          LA MARCHE D’APRÈS
        </text>
      </g>

      <text
        x="40"
        y="372"
        fill={soft}
        fontFamily={mono}
        fontSize="12"
        letterSpacing="1.8"
      >
        PARCOURS
      </text>
    </svg>
  );
}

/** Un cadre de démonstration. Marqué EXEMPLE en cote, à la manière d'un détail
 *  rapporté sur un plan : personne ne doit lire ces chiffres comme les siens. */
function Exemple({
  legende,
  children,
}: {
  legende: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <div className="border-border bg-card shadow-raised overflow-hidden rounded-xl border">
        {children}
      </div>
      <figcaption className={`text-muted-foreground ${LABEL}`}>
        Exemple · {legende}
      </figcaption>
    </figure>
  );
}

export function Landing() {
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
      {/* ── Le plan encre ─────────────────────────────────────────────── */}
      {/* Le titre porte toute la largeur et l'élévation passe DESSOUS, pleine
          page. Reléguée en colonne, elle illustrait un texte ; ici elle est
          l'argument, et le texte la légende. */}
      <section className={INK}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 sm:py-20">
          <div className="flex flex-col gap-7 motion-safe:animate-[landing-rise_700ms_var(--ease-soft)_both]">
            <p className={`${INK_MUTED} ${LABEL}`}>
              MissionPilot — moteur de recherche d’emploi, open source
            </p>
            <h1 className="max-w-4xl text-[clamp(2.25rem,5.4vw,4rem)] leading-[1.03] font-semibold tracking-[-0.035em] text-balance">
              On ne cherche pas un emploi à votre place.{" "}
              <span className={GOLD}>On vous fait monter d’une marche.</span>
            </h1>
            <div className="grid gap-x-12 gap-y-4 lg:grid-cols-2">
              <p className={`${INK_MUTED} text-lg leading-relaxed text-pretty`}>
                Déposez votre CV. L’IA lit votre parcours comme une{" "}
                <strong className="font-medium text-[oklch(0.97_0.005_85)]">
                  trajectoire
                </strong>{" "}
                — comment ont évolué votre périmètre, vos équipes, votre
                autonomie — et vous pose une question quand elle ne peut pas
                trancher.
              </p>
              <p className={`${INK_MUTED} text-lg leading-relaxed text-pretty`}>
                Puis, à chaque connexion, elle vous montre ce que le marché a
                pour vous{" "}
                <strong className="font-medium text-[oklch(0.97_0.005_85)]">
                  maintenant
                </strong>{" "}
                : y compris le poste que vous n’auriez pas osé demander, avec
                les preuves tirées de votre propre parcours.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/login"
                className="rounded-md bg-[oklch(0.97_0.005_85)] px-5 py-2.5 text-sm font-medium text-[oklch(0.155_0.025_265)] motion-safe:transition-opacity hover:opacity-90"
              >
                J’ai un compte — se connecter
              </Link>
              <a
                href="https://github.com/Christophevanengelen/missionpilot"
                target="_blank"
                rel="noopener"
                className={`rounded-md border px-5 py-2.5 text-sm font-medium ${INK_RULE} motion-safe:transition-colors hover:border-[oklch(0.97_0.005_85_/_38%)]`}
              >
                Voir le code
              </a>
            </div>
          </div>

          <div className="motion-safe:animate-[landing-fade_900ms_var(--ease-soft)_both]">
            {/* Les trois cotes du grand dessin passent ici en légende HTML.
                Serrées dans un viewBox de 400, elles se chevauchaient et
                traversaient les contremarches ; une annotation illisible ne
                vaut pas mieux qu'une annotation absente, et sous le dessin
                elles se lisent. */}
            <div className="flex flex-col gap-3 sm:hidden">
              <ElevationCompacte />
              <p className={`${INK_MUTED} ${LABEL}`}>
                Ce qui monte : périmètre · équipes · autonomie
              </p>
            </div>
            <div className="hidden sm:block">
              <Elevation />
            </div>
          </div>
        </div>
      </section>

      {/* ── Les deux refus ────────────────────────────────────────────── */}
      <section aria-labelledby="refus" className={INK}>
        <div className="mx-auto w-full max-w-6xl px-6 pb-16 sm:pb-20">
          <h2 id="refus" className={`${INK_MUTED} ${LABEL} pb-6`}>
            Ce que ce produit ne fera jamais
          </h2>
          {/* Filets par `gap-px` sur un fond couleur-filet : la bordure est
              alors le fond qui transparaît entre les cellules, donc jamais
              doublée à la jointure et jamais dépendante d'une largeur
              d'`outline` par défaut. Les cellules sont posées sur une encre
              PLUS CLAIRE que le plan : à valeur égale, deux refus alignés sur
              le fond se lisaient comme deux paragraphes de plus, alors que ce
              sont les deux engagements qui rendent le reste croyable. */}
          <ul className="grid gap-px overflow-hidden rounded-xl bg-[oklch(0.97_0.005_85_/_14%)] sm:grid-cols-2">
            {[
              {
                titre: "Aucune offre n’est stockée.",
                detail:
                  "Chaque recherche interroge les plateformes en direct. Votre profil est la seule chose que nous gardons.",
              },
              {
                titre: "Nous ne postulons jamais à votre place.",
                detail:
                  "Vous cliquez, vous partez sur l’annonce d’origine, chez l’employeur. Rien n’est envoyé en votre nom.",
              },
            ].map((r) => (
              <li
                key={r.titre}
                className="flex flex-col gap-3 bg-[oklch(0.195_0.028_265)] p-7 sm:p-9"
              >
                <p className="text-2xl leading-snug font-medium tracking-tight text-balance">
                  {r.titre}
                </p>
                <p className={`${INK_MUTED} leading-relaxed text-pretty`}>
                  {r.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Le miroir ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="miroir"
        className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-20"
      >
        <div className="flex flex-col gap-5">
          <p className={`text-rise ${LABEL}`}>01 — Il vous relit</p>
          <h2
            id="miroir"
            className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            D’abord il vous dit ce qu’il a compris. Y compris ce qu’il ignore.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            Avant de vous demander quoi que ce soit, le produit vous restitue
            votre parcours tel qu’il l’a lu. Les trous sont écrits en toutes
            lettres : « votre CV ne le dit pas ».
          </p>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            Puis il pose{" "}
            <strong className="text-foreground font-medium">
              une seule question à la fois
            </strong>{" "}
            — celle qui change vraiment la lecture. Deviner vers le haut coûte
            des mois de refus ; deviner vers le bas, c’est le plafond lui-même.
          </p>
        </div>

        <Exemple legende="ce que le produit affiche après un import de CV">
          <dl className="divide-border divide-y">
            {[
              ["Rôle", "Senior Service Designer", false],
              ["Séniorité", "11 ans", false],
              ["Équipes encadrées", "votre CV ne le dit pas", true],
              ["Budget piloté", "votre CV ne le dit pas", true],
            ].map(([cle, valeur, manquant]) => (
              <div
                key={cle as string}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3.5"
              >
                <dt className={`text-muted-foreground ${LABEL}`}>{cle}</dt>
                <dd
                  className={
                    manquant
                      ? "text-rise text-sm"
                      : "text-sm font-medium tabular-nums"
                  }
                >
                  {valeur}
                </dd>
              </div>
            ))}
          </dl>
          <div className="bg-muted/40 border-border flex flex-col gap-3 border-t p-5">
            <p className="text-sm font-medium text-pretty">
              Avez-vous déjà encadré une équipe ?
            </p>
            <div className="flex flex-wrap gap-2">
              {["Je ne sais pas", "Oui, ponctuellement", "Oui, en direct"].map(
                (choix) => (
                  <span
                    key={choix}
                    className="border-border bg-card rounded-full border px-3 py-1.5 text-xs"
                  >
                    {choix}
                  </span>
                ),
              )}
            </div>
          </div>
        </Exemple>
      </section>

      {/* ── La matière première ───────────────────────────────────────── */}
      <section
        aria-labelledby="sources"
        className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 sm:py-28"
      >
        <div className="flex max-w-2xl flex-col gap-5">
          <p className={`text-rise ${LABEL}`}>02 — Il cherche large</p>
          <h2
            id="sources"
            className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Le but est de conclure, pas de bien filtrer.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            Quand une source ne dit ni le salaire, ni le contrat, ni le
            télétravail, l’offre est affichée{" "}
            <em className="text-foreground not-italic">non précisé</em> — et
            elle reste dans la liste. L’écarter reviendrait à vous cacher une
            bonne offre parce que son annonceur est avare en détails.
          </p>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            Et quand une plateforme ne répond pas, le produit vous le dit au
            lieu de faire comme s’il avait tout couvert.
          </p>
        </div>

        <ul className="bg-border grid gap-px overflow-hidden rounded-xl sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Adzuna",
            "France Travail",
            "Remotive",
            "Himalayas",
            "Jobicy",
            "Remote OK",
            "Recruitee",
          ].map((nom) => (
            <li
              key={nom}
              className={`bg-card ${LABEL} text-muted-foreground px-4 py-4`}
            >
              {nom}
            </li>
          ))}
          <li className="bg-card text-rise px-4 py-4 text-xs">
            interrogées en direct
          </li>
        </ul>
      </section>

      {/* ── La marche ─────────────────────────────────────────────────── */}
      <section
        aria-labelledby="marche"
        className="border-border border-y bg-[var(--surface-raised)]"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center lg:gap-20">
          {/* Le texte AVANT l'exemple dans le DOM, et l'inversion réservée aux
              grands écrans. En une seule colonne, la carte arrivait la première
              et on lisait un écran de résultats avant de savoir ce qu'on
              regardait. L'alternance visuelle ne vaut pas ce prix-là. */}
          <div className="flex flex-col gap-5">
            <p className={`text-rise ${LABEL}`}>03 — Il vous fait monter</p>
            <h2
              id="marche"
              className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              Beaucoup de gens postulent au poste qu’ils avaient déjà.
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
              Parce que personne ne leur a jamais dit qu’ils étaient prêts pour
              le suivant. C’est ce plafond invisible que ce produit existe pour
              lever — et il ne se contente pas de l’affirmer, il joint les
              preuves tirées de votre propre dossier.
            </p>
          </div>

          <div className="lg:order-first">
            <Exemple legende="l’écran de résultats, à chaque connexion">
              <div className="flex flex-col">
                <div className="border-rise/40 bg-rise/[0.06] flex flex-col gap-1 border-b border-l-2 px-5 py-4">
                  <p className={`text-rise ${LABEL}`}>La marche d’après</p>
                  <p className="font-medium">CX Transformation Lead</p>
                  <p className="text-muted-foreground text-sm text-pretty">
                    Un cran au-dessus de votre niveau actuel. Votre parcours
                    montre que vous pouvez le défendre : 11 ans, un périmètre
                    passé de 1 à 4 pays, une refonte pilotée de bout en bout.
                  </p>
                </div>
                <div className="flex flex-col gap-1 px-5 py-4">
                  <p className={`text-muted-foreground ${LABEL}`}>
                    À votre niveau
                  </p>
                  <p className="font-medium">Senior Service Designer</p>
                  <p className="text-muted-foreground text-sm">
                    Là où votre profil est immédiatement lisible.
                  </p>
                </div>
              </div>
            </Exemple>
          </div>
        </div>
      </section>

      {/* ── Accès ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="acces" className={`${INK} mt-auto`}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16 sm:py-20">
          <h2
            id="acces"
            className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Y accéder
          </h2>
          <p
            className={`${INK_MUTED} max-w-2xl text-lg leading-relaxed text-pretty`}
          >
            MissionPilot est en{" "}
            <strong className="font-medium text-[oklch(0.97_0.005_85)]">
              bêta privée
            </strong>{" "}
            : les comptes sont créés par l’administrateur et les inscriptions
            sont fermées. Il n’y a donc rien à remplir ici, et ce serait vous
            faire perdre votre temps que de le prétendre.
          </p>
          <p
            className={`${INK_MUTED} max-w-2xl text-lg leading-relaxed text-pretty`}
          >
            En revanche le projet est{" "}
            <strong className="font-medium text-[oklch(0.97_0.005_85)]">
              open source
            </strong>{" "}
            : vous pouvez lire le code, et l’héberger vous-même.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/login"
              className="rounded-md bg-[oklch(0.97_0.005_85)] px-5 py-2.5 text-sm font-medium text-[oklch(0.155_0.025_265)] motion-safe:transition-opacity hover:opacity-90"
            >
              J’ai un compte — se connecter
            </Link>
            <a
              href="https://github.com/Christophevanengelen/missionpilot"
              target="_blank"
              rel="noopener"
              className={`rounded-md border px-5 py-2.5 text-sm font-medium ${INK_RULE} motion-safe:transition-colors hover:border-[oklch(0.97_0.005_85_/_38%)]`}
            >
              Voir le code
            </a>
          </div>
          <p className={`${INK_MUTED} ${LABEL} border-t pt-6 ${INK_RULE} mt-4`}>
            Aucune offre stockée · aucune candidature envoyée en votre nom
          </p>
        </div>
      </section>
    </main>
  );
}
