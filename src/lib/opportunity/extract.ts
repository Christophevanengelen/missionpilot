/**
 * Deterministic, rule-based extraction from pasted source text (Phase 2).
 * Pure and framework-free — no AI call, no wall-clock, no randomness: the
 * same input always yields the same normalized output. This is honest
 * normalization, NOT an LLM: it reads structure it can defend and lists
 * everything else under `unknowns`. Real model-based extraction (through the
 * AiProvider abstraction) is a later Phase 2 PR.
 *
 * The source text is treated strictly as DATA: it is scanned for patterns and
 * can never change the rules, the schema, or what counts as "found".
 */
import { createHash } from "node:crypto";
import {
  NORMALIZED_FIELDS,
  normalizedOpportunitySchema,
  type EngagementType,
  type NormalizedOpportunity,
  type OpportunityExtraction,
  type RemoteType,
} from "@/domain/opportunity";

/** SHA-256 of the exact source text — the snapshot's immutable identity. */
export function contentHash(rawText: string): string {
  return createHash("sha256").update(rawText, "utf8").digest("hex");
}

/** Case/space-insensitive canonical identity for per-owner dedup. */
export function canonicalFingerprint(n: NormalizedOpportunity): string {
  const norm = (s: string | null) =>
    (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const basis = `${norm(n.title)}|${norm(n.organization)}|${norm(
    n.locationText,
  )}`;
  return createHash("sha256").update(basis, "utf8").digest("hex");
}

const lines = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

function firstMatch(raw: string, re: RegExp): string | null {
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

function detectEngagement(raw: string): EngagementType | null {
  const t = raw.toLowerCase();
  if (
    /\bfreelance\b|\bfreelancing\b|\bind[ée]pendant\b|\bconsultant\b|\btjm\b/.test(
      t,
    )
  )
    return "freelance";
  if (/\binterim\b|\bintérim\b|\bcontract\b|\bcdd\b/.test(t)) return "interim";
  if (/\bpart[- ]time\b|\btemps partiel\b/.test(t)) return "part_time";
  if (/\bpermanent\b|\bcdi\b|\bfull[- ]time\b|\btemps plein\b/.test(t))
    return "permanent";
  return null;
}

function detectRemote(raw: string): RemoteType | null {
  const t = raw.toLowerCase();
  // "hybrid" wins over a bare "remote" mention. Note: no dedicated "100 %
  // remote" branch — it is redundant with the bare-remote fallback below,
  // and its adjacent `\s*` groups were a quadratic-backtracking (ReDoS)
  // hazard on adversarial pasted text.
  if (/\b(?:hybrid|hybride)\b/.test(t)) return "hybrid";
  if (/\bon[- ]?site\b|\bsur site\b|\bpr[ée]sentiel\b/.test(t)) return "onsite";
  if (/\bremote\b|\bt[ée]l[ée]travail\b/.test(t)) return "remote_only";
  return null;
}

function detectSeniority(raw: string): string | null {
  const m = raw.match(
    /\b(senior|junior|lead|principal|staff|mid[- ]level|confirm[ée])\b/i,
  );
  return m ? m[1] : null;
}

function detectListSection(raw: string, headers: RegExp): string[] {
  const ls = lines(raw);
  const out: string[] = [];
  let inSection = false;
  for (const line of ls) {
    if (headers.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      // A new header-looking line (ends with ':') ends the section.
      if (/^[A-Za-zÀ-ÿ ]{3,40}:\s*$/.test(line)) break;
      const bullet = line.replace(/^[-*•·—\d.)\s]+/, "").trim();
      if (bullet.length >= 2 && bullet.length <= 500) out.push(bullet);
      if (out.length >= 50) break;
    }
  }
  return out;
}

function detectCompensation(raw: string): {
  min: number | null;
  max: number | null;
  currency: NormalizedOpportunity["compensationCurrency"];
  period: NormalizedOpportunity["compensationPeriod"];
} {
  const t = raw.replace(/ /g, " ");
  const currency = /€|eur\b/i.test(t)
    ? "EUR"
    : /\$|usd\b/i.test(t)
      ? "USD"
      : /£|gbp\b/i.test(t)
        ? "GBP"
        : /chf\b/i.test(t)
          ? "CHF"
          : null;
  const period = /\b(tjm|\/\s*jour|per day|\/day|par jour)\b/i.test(t)
    ? "day"
    : /\b(\/\s*h|per hour|\/hour|de l'heure)\b/i.test(t)
      ? "hour"
      : /\b(\/\s*mois|per month|\/month|par mois)\b/i.test(t)
        ? "month"
        : /\b(\/\s*an|per year|\/year|par an|annuel)\b/i.test(t)
          ? "year"
          : null;
  const toInt = (s: string) => {
    const n = Number.parseInt(s.replace(/[.,]/g, ""), 10);
    return Number.isNaN(n) || n > 100000000 ? null : n;
  };
  // A figure is only compensation when it is ADJACENT to a money/rate signal
  // — a currency symbol/code or a per-period marker right after it, or a
  // pay keyword right before it. This never surfaces a stray number (e.g. a
  // "8-10 ans" experience range, or the first digit elsewhere in the text).
  // Character classes exclude whitespace, so a match can't span lines.
  const moneyAfter =
    /(\d[\d.,]{0,8})(?:\s*[-–à]\s*(\d[\d.,]{0,8}))?\s*(?:€|k€|eur|\$|usd|£|gbp|chf|\/\s*(?:jour|day|h|hour|mois|month|an|year))/i;
  const keywordBefore =
    /(?:tjm|salaire|salary|r[ée]mun[ée]ration|compensation|day rate|package)\s*:?\s*(\d[\d.,]{0,8})(?:\s*[-–à]\s*(\d[\d.,]{0,8}))?/i;
  const m = t.match(moneyAfter) ?? t.match(keywordBefore);
  if (m) {
    const a = toInt(m[1]);
    const b = m[2] ? toInt(m[2]) : a;
    // A range is order-agnostic: normalise so min ≤ max.
    const [min, max] = a !== null && b !== null && a > b ? [b, a] : [a, b];
    return { min, max, currency, period };
  }
  // No money-adjacent figure: keep any currency/period signal (a real
  // textual marker) but never invent an amount.
  return { min: null, max: null, currency, period };
}

/** Extract a normalized opportunity + honest unknowns from pasted text. */
export function extractFromPastedText(rawText: string): OpportunityExtraction {
  const ls = lines(rawText);
  const title = ls[0]?.slice(0, 500) ?? null;
  const organization =
    firstMatch(rawText, /(?:chez|@|at)\s+([A-Z][\w&.\- ]{1,60})/) ??
    firstMatch(rawText, /(?:company|entreprise|soci[ée]t[ée])\s*:\s*(.+)/i);
  const comp = detectCompensation(rawText);

  const draft = {
    title,
    organization: organization ? organization.trim().slice(0, 300) : null,
    engagementType: detectEngagement(rawText),
    seniority: detectSeniority(rawText),
    // A meaningful normalized description is not deterministically
    // extractable — the full source lives in the frozen snapshot. Left
    // undetermined here (honest); the LLM extraction PR will summarise it.
    description: null,
    requirements: detectListSection(
      rawText,
      /^(requirements|exigences|profil recherch[ée]|must[- ]have)\s*:?\s*$/i,
    ),
    responsibilities: detectListSection(
      rawText,
      /^(responsibilities|missions|responsabilit[ée]s|what you'll do)\s*:?\s*$/i,
    ),
    skills: detectListSection(
      rawText,
      /^(skills|comp[ée]tences|stack|technologies)\s*:?\s*$/i,
    ),
    locationText: firstMatch(
      rawText,
      /(?:location|lieu|localisation|based in|bas[ée] [àa])\s*:?\s*([A-Za-zÀ-ÿ,'\- ]{2,60})/i,
    ),
    remoteType: detectRemote(rawText),
    compensationMin: comp.min,
    compensationMax: comp.max,
    compensationCurrency: comp.currency,
    compensationPeriod: comp.period,
    sourceName: null,
    sourceUrl: firstMatch(rawText, /(https?:\/\/[^\s]+)/),
  };

  // Validate/normalize through the domain schema (drops empties to null via
  // its own rules) and compute the honest unknowns list.
  const normalized = normalizedOpportunitySchema.parse(draft);
  const unknowns = NORMALIZED_FIELDS.filter((f) => {
    const v = normalized[f];
    return v === null || (Array.isArray(v) && v.length === 0);
  });

  return { normalized, unknowns };
}
