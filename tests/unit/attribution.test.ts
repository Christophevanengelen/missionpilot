import { describe, expect, it } from "vitest";
import { attributionLink } from "@/lib/discovery/attribution";

/**
 * This function arbitrates between two rules that both matter: the product's
 * long-standing "provenance is shown, never live" safety rule, and the
 * contractual duty of several sources to be credited WITH a link. A link is
 * offered only when the URL demonstrably belongs to the source that supplied
 * it; everything else stays inert text.
 */
describe("attributionLink", () => {
  it("links a source to its own domain", () => {
    expect(
      attributionLink(
        "Himalayas",
        "https://himalayas.app/companies/nova/jobs/x",
      ),
    ).toBe("https://himalayas.app/companies/nova/jobs/x");
    expect(attributionLink("Jobicy", "https://jobicy.com/jobs/147618")).toBe(
      "https://jobicy.com/jobs/147618",
    );
    // Subdomains and regional hosts count as the source's own.
    expect(
      attributionLink(
        "France Travail",
        "https://candidat.francetravail.fr/o/1",
      ),
    ).toBe("https://candidat.francetravail.fr/o/1");
    expect(attributionLink("Adzuna", "https://www.adzuna.fr/details/1")).toBe(
      "https://www.adzuna.fr/details/1",
    );
  });

  it("refuses a lookalike host", () => {
    // Suffix matching is anchored to the END of the host, so an attacker
    // cannot borrow a trusted name as a prefix.
    expect(
      attributionLink("Himalayas", "https://himalayas.app.evil.com/x"),
    ).toBeNull();
    expect(attributionLink("Jobicy", "https://notjobicy.com/x")).toBeNull();
  });

  it("keeps a pasted import inert, whatever its URL", () => {
    // A URL import records the HOST as its source name, which is never a known
    // source — this is what preserves the e2e-guarded "never a live link" rule
    // for arbitrary user input.
    expect(
      attributionLink("jobs.example.com", "https://jobs.example.com/data-eng"),
    ).toBeNull();
    expect(attributionLink(null, "https://jobs.example.com/x")).toBeNull();
  });

  it("never turns a dangerous scheme into a link", () => {
    expect(attributionLink("Himalayas", "javascript:alert(1)")).toBeNull();
    expect(attributionLink("Jobicy", "data:text/html,<script>")).toBeNull();
    expect(attributionLink("Jobicy", "not a url")).toBeNull();
    expect(attributionLink("Jobicy", null)).toBeNull();
  });

  it("refuses a known source pointing somewhere unexpected", () => {
    // If Himalayas ever handed us an employer ATS URL, crediting them with a
    // link to Greenhouse would satisfy nobody — and it is not their domain.
    expect(
      attributionLink("Himalayas", "https://boards.greenhouse.io/nova/jobs/1"),
    ).toBeNull();
  });
});
