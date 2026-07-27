import "server-only";

/**
 * Shared HTML → readable-text reduction for every discovery source that ships
 * a `description` as HTML (Remotive, Himalayas, Jobicy, …).
 *
 * This lives in ONE place on purpose. It is not cosmetic — it is the boundary
 * that stops a remote source from planting a "fact" in our database, and a
 * duplicated copy is a copy that will miss the next hardening.
 *
 * Two rules carry that weight:
 * 1. Never-rendered elements (`script`, `style`) and explicitly hidden ones
 *    (`display:none`, `visibility:hidden`, `hidden`) are removed WITH their
 *    body. Stripping only their tags would promote text the ad NEVER DISPLAYED
 *    into the description; the deterministic extractor would then read a
 *    "TJM 2000 EUR" nobody ever saw and store it as a stated fact — and that
 *    text would go on to reach the LLM prompts.
 * 2. The generic tag strip must tolerate `>` inside attribute values, so a
 *    quoted attribute (`alt="a > b"`) cannot swallow the visible text that
 *    follows it.
 */
export function toPlainText(html: string): string {
  return (
    html
      // Non-rendered elements first, body included (both terminated and
      // truncated/unterminated forms).
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<(script|style)\b[^>]*>[\s\S]*$/gi, " ")
      // Explicitly hidden elements, body included.
      .replace(
        /<([a-z]+)\b[^>]*\bstyle\s*=\s*(["'])[^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*\2[^>]*>[\s\S]*?<\/\1\s*>/gi,
        " ",
      )
      .replace(
        /<([a-z]+)\b[^>]*\bhidden(?=[\s>])[^>]*>[\s\S]*?<\/\1\s*>/gi,
        " ",
      )
      .replace(/<br\s*\/?>(?=\s*\S)/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      // Tag strip that understands quoted attributes (so `alt="a > b"` cannot
      // eat the following sentence) and drops a trailing unterminated tag.
      //
      // Le `[^>"']*` ferme les DEUX branches, et c'est tout le correctif. Il
      // n'était rattaché qu'à l'apostrophe simple, si bien qu'après un premier
      // attribut entre guillemets doubles rien ne pouvait consommer le
      // ` style=` suivant : la correspondance échouait et la balise entière
      // était recrachée en texte. Autrement dit, le dépouillement ne marchait
      // que sur les balises à UN seul attribut — presque jamais dans du HTML
      // réel. Les cartes d'offres affichaient des pavés de CSS à la place des
      // descriptions.
      .replace(/<[a-z!/][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/gi, " ")
      .replace(/<[a-z!/][^>]*$/gi, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&hellip;/gi, "…")
      .replace(/[ \t]+/g, " ")
      // Les balises dépouillées laissent une espace là où elles étaient, donc
      // chaque paragraphe commençait par une indentation d'un caractère —
      // discret dans une chaîne, très visible sur une carte d'offre.
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * The first candidate that yields readable text, cleaned — or null.
 *
 * Sources ship a long `description` and a short `excerpt`, and a naive
 * `a ? clean(a) : b` gets BOTH cases wrong:
 * - it forgets to clean the fallback, so a hostile `excerpt` walks straight
 *   past the guard above and its never-displayed text becomes a stated fact;
 * - and an empty-but-present `description` (`"<p></p>"` cleans to `""`) is
 *   truthy, so it shadows a perfectly good excerpt and then travels on as an
 *   empty string — which downstream reads as "stated, and blank" rather than
 *   "the source did not say".
 *
 * Every candidate goes through the same cleaner, and an empty result is null.
 */
export function firstPlainText(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const cleaned = toPlainText(candidate);
    if (cleaned !== "") return cleaned;
  }
  return null;
}
