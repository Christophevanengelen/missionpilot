import { describe, expect, it } from "vitest";
import {
  DEFAULT_TONE_VOICE,
  resolveBannedPhrases,
  resolveToneVoice,
  type ToneContractRow,
} from "@/lib/matching/tone-contract";

// A profile with no tone_contracts row yet must still draft correctly with a
// hardcoded GENERIC default (never an invented "founder voice") — and the
// existing FR-only draft path must stay unchanged (Apply Pack L3).

const CONTRACT: ToneContractRow = {
  voice_rules: "Ton chaleureux, phrases longues.",
  signature_name: "A. Dupont",
  salutation_fr: "Bonjour,",
  salutation_en: "Hello,",
  closing_fr: "Bien à vous,",
  closing_en: "Regards,",
  banned_phrases: ["synergie", "couteau suisse"],
};

describe("resolveToneVoice", () => {
  it("no contract + fr resolves to the generic FR default — no regression", () => {
    expect(resolveToneVoice(null, "fr")).toEqual(DEFAULT_TONE_VOICE.fr);
  });

  it("no contract + en resolves to the generic EN default", () => {
    expect(resolveToneVoice(null, "en")).toEqual(DEFAULT_TONE_VOICE.en);
  });

  it("a contract resolves to its own FR fields for fr", () => {
    expect(resolveToneVoice(CONTRACT, "fr")).toEqual({
      voiceRules: "Ton chaleureux, phrases longues.",
      signatureName: "A. Dupont",
      salutation: "Bonjour,",
      closing: "Bien à vous,",
    });
  });

  it("the SAME contract resolves to its own EN fields for en — never a mix", () => {
    expect(resolveToneVoice(CONTRACT, "en")).toEqual({
      voiceRules: "Ton chaleureux, phrases longues.",
      signatureName: "A. Dupont",
      salutation: "Hello,",
      closing: "Regards,",
    });
  });

  it("the generic defaults are not identical between languages", () => {
    expect(DEFAULT_TONE_VOICE.fr.salutation).not.toBe(
      DEFAULT_TONE_VOICE.en.salutation,
    );
  });
});

describe("resolveBannedPhrases", () => {
  it("no contract yields no extra banned phrases", () => {
    expect(resolveBannedPhrases(null)).toEqual([]);
  });

  it("a contract's own banned phrases are returned as-is", () => {
    expect(resolveBannedPhrases(CONTRACT)).toEqual([
      "synergie",
      "couteau suisse",
    ]);
  });
});
