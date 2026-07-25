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
      .replace(/<[a-z!/][^>"']*(?:"[^"]*"|'[^']*'[^>"']*)*>/gi, " ")
      .replace(/<[a-z!/][^>]*$/gi, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&hellip;/gi, "…")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
