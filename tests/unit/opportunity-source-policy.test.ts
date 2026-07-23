import { describe, expect, it } from "vitest";
import { classifySource } from "@/lib/opportunity/source-policy";

describe("classifySource", () => {
  it("accepts a public https URL as a manual-only source", () => {
    const c = classifySource("https://jobs.example.com/senior-designer");
    expect(c.decision).toBe("manual_only");
    expect(c.host).toBe("jobs.example.com");
    expect(c.reason).toBe("ok");
  });

  it("blocks an invalid URL", () => {
    expect(classifySource("not a url").decision).toBe("blocked");
    expect(classifySource("not a url").reason).toBe("invalid_url");
  });

  it("blocks a non-http(s) scheme", () => {
    const c = classifySource("ftp://files.example.com/x");
    expect(c.decision).toBe("blocked");
    expect(c.reason).toBe("unsupported_scheme");
    const f = classifySource("file:///etc/passwd");
    expect(f.reason).toBe("unsupported_scheme");
  });

  it("blocks private / internal hosts (SSRF hygiene)", () => {
    for (const url of [
      "http://localhost:3000/x",
      "http://app.local/x",
      "http://127.0.0.1/x",
      "http://10.0.0.5/x",
      "http://192.168.1.10/x",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/x",
    ]) {
      const c = classifySource(url);
      expect(c.decision, url).toBe("blocked");
      expect(c.reason, url).toBe("private_host");
    }
  });

  it("blocks a bare public IP literal too (a source is a named site)", () => {
    expect(classifySource("http://8.8.8.8/job").reason).toBe("private_host");
  });

  it("closes IPv6-literal and trailing-dot SSRF bypasses", () => {
    for (const url of [
      "http://[::ffff:169.254.169.254]/latest/meta-data", // IPv4-mapped metadata
      "http://[::ffff:127.0.0.1]/", // IPv4-mapped loopback
      "http://[::]/", // unspecified
      "http://[2606:4700:4700::1111]/", // public IPv6 literal
      "http://localhost./", // trailing-dot loopback
      "http://127.0.0.1./", // trailing-dot IPv4 loopback
    ]) {
      const c = classifySource(url);
      expect(c.decision, url).toBe("blocked");
      expect(c.reason, url).toBe("private_host");
    }
  });

  it("blocks domains whose terms forbid importing, incl. subdomains", () => {
    expect(classifySource("https://www.linkedin.com/jobs/123").reason).toBe(
      "terms_forbid",
    );
    expect(classifySource("https://fr.indeed.com/x").decision).toBe("blocked");
    expect(classifySource("https://glassdoor.com/x").reason).toBe(
      "terms_forbid",
    );
  });

  it("is deterministic and never throws on junk input", () => {
    for (const s of [
      "",
      "   ",
      "http://",
      "https://a",
      "javascript:alert(1)",
    ]) {
      expect(() => classifySource(s)).not.toThrow();
    }
  });
});
