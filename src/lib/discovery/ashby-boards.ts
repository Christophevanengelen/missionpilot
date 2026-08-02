/**
 * Les tableaux d'offres Ashby interrogés par ce déploiement.
 *
 * MÊME RÉGIME QUE GREENHOUSE ET RECRUITEE : `api.ashbyhq.com/posting-api` est
 * l'API qu'Ashby publie pour que ses clients affichent leur tableau d'offres
 * ailleurs que sur leur site. Sans authentification parce qu'elle est faite
 * pour être lue par des tiers ; l'employeur a choisi d'y publier.
 *
 * POURQUOI CETTE SOURCE MÉRITE SA PLACE À CÔTÉ DE GREENHOUSE, alors que les
 * deux font le même métier : Ashby expose `employmentType`. C'est le seul
 * champ qui dise « Contract » plutôt que de laisser deviner, et distinguer une
 * mission d'un poste salarié est exactement ce que ce produit doit savoir
 * faire. Greenhouse ne l'expose pas et laisse donc ce champ vide.
 *
 * LE NOM D'AFFICHAGE EST ÉCRIT ICI, et ce n'est pas de la décoration : la
 * réponse d'Ashby ne porte AUCUN nom d'entreprise — le jeton est la seule
 * identité disponible. Afficher « elevenlabs » à quelqu'un serait lui montrer
 * une clé technique. La casse correcte est donc une donnée, pas un détail.
 *
 * Chaque jeton a été appelé le 2026-08-02 ; les chiffres en commentaire sont
 * ce que l'API a rendu ce jour-là. Aucun n'a été ajouté de mémoire.
 */

export type AshbyBoard = { jeton: string; nom: string };

/** Les tableaux qu'un employeur a demandé qu'on cesse d'interroger. Présente
 *  avant d'être nécessaire — voir le raisonnement dans `greenhouse-boards`. */
export const EXCLUDED_ASHBY: readonly string[] = [];

export const ASHBY_BOARDS: readonly AshbyBoard[] = [
  { jeton: "elevenlabs", nom: "ElevenLabs" }, // 224 offres, 120 en Europe
  { jeton: "voodoo", nom: "Voodoo" }, // 109 · 96 — dont des contrats
  { jeton: "alan", nom: "Alan" }, // 98 · 95 — dont des contrats
  { jeton: "openai", nom: "OpenAI" }, // 754 · 75
  { jeton: "pennylane", nom: "Pennylane" }, // 115 · 59 — dont des contrats
  { jeton: "synthesia", nom: "Synthesia" }, // 76 · 53
  { jeton: "qonto", nom: "Qonto" }, // 37 · 34
  { jeton: "vanta", nom: "Vanta" }, // 100 · 27
  { jeton: "notion", nom: "Notion" }, // 109 · 14
  { jeton: "backmarket", nom: "Back Market" }, // 15 · 12
  { jeton: "cursor", nom: "Cursor" }, // 120 · 11
  { jeton: "ramp", nom: "Ramp" }, // 126 · 10 — dont des contrats
  { jeton: "linear", nom: "Linear" }, // 23 · 8
  { jeton: "ledger", nom: "Ledger" }, // 9 · 8 — dont des contrats
  { jeton: "sorare", nom: "Sorare" }, // 4 · 4
  { jeton: "posthog", nom: "PostHog" }, // 9 · 2
  // ── Deuxième passe de curation, 2026-08-02 ──────────────────────────────
  { jeton: "n8n", nom: "n8n" }, // 37 · 27
  { jeton: "langchain", nom: "LangChain" }, // 93 · 19
  { jeton: "modal", nom: "Modal" }, // 31 · 11
  { jeton: "docker", nom: "Docker" }, // 58 · 10 — dont des contrats
  { jeton: "weaviate", nom: "Weaviate" }, // 2 · 2
];

/** Les tableaux réellement interrogés : la liste curée moins les retraits. */
export function activeAshbyBoards(
  boards: readonly AshbyBoard[] = ASHBY_BOARDS,
  excluded: readonly string[] = EXCLUDED_ASHBY,
): AshbyBoard[] {
  const out = new Set(excluded.map((b) => b.trim().toLowerCase()));
  const vus = new Set<string>();
  const actifs: AshbyBoard[] = [];
  for (const board of boards) {
    const jeton = board.jeton.trim().toLowerCase();
    // Le jeton entre dans un chemin d'URL : on ÉCARTE ce qui n'est pas une
    // étiquette simple plutôt que de l'échapper. Aucun jeton légitime ne
    // contient de barre, de point ou d'arobase.
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(jeton)) continue;
    if (out.has(jeton) || vus.has(jeton)) continue;
    vus.add(jeton);
    actifs.push({ jeton, nom: board.nom.trim() || jeton });
  }
  return actifs;
}
