import { describe, expect, it } from "vitest";
import { detectSkills } from "@/lib/profile/cv-extract";

describe("detectSkills", () => {
  it("detects canonical names and aliases, de-duplicated in taxonomy order", () => {
    const found = detectSkills(
      "Senior engineer — JavaScript, TS, React, React.js, and k8s on AWS.",
    );
    expect(found).toEqual([
      "JavaScript",
      "TypeScript",
      "React",
      "AWS",
      "Kubernetes",
    ]);
  });

  it("respects word boundaries (Go vs Django), matches hyphenated forms", () => {
    expect(detectSkills("Django and Mongo experience")).not.toContain("Go");
    expect(detectSkills("Led the go-live and ongoing support")).toContain("Go");
    expect(detectSkills("ongoing")).not.toContain("Go");
  });

  it("handles punctuation in skill names", () => {
    const found = detectSkills("Stack: C#, C++, Node.js, CI/CD, Next.js.");
    expect(found).toEqual(
      expect.arrayContaining(["C#", "C++", "Node.js", "CI/CD", "Next.js"]),
    );
  });

  it("does not read an extension-style suffix as a standalone skill", () => {
    // "Node.js" must not trigger the "js" alias (a false JavaScript hit) —
    // but an explicit standalone "JS" still does.
    const fromNode = detectSkills("Backend: Node.js and PostgreSQL.");
    expect(fromNode).toContain("Node.js");
    expect(fromNode).not.toContain("JavaScript");
    expect(detectSkills("JS/TS developer")).toEqual(
      expect.arrayContaining(["JavaScript", "TypeScript"]),
    );
  });

  it("never fabricates skills and returns [] for empty or skill-free text", () => {
    expect(detectSkills("")).toEqual([]);
    expect(detectSkills("   ")).toEqual([]);
    expect(detectSkills("I enjoy cooking, hiking and photography.")).toEqual(
      [],
    );
  });
});
