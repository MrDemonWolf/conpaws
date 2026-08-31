import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * robots.txt is the one surface where getting it wrong is expensive in both
 * directions: an allow-all on a preview lets it compete with the real site for
 * its own terms, and a disallow-all on production asks Google to forget us.
 *
 * The behaviour depends entirely on `NEXT_PUBLIC_SITE_URL`, which is read at
 * module scope, so every case re-imports with a fresh module registry.
 */
async function robotsFor(siteUrl: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  const { default: robots } = await import("./robots");
  return robots();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robots.txt", () => {
  it("lets crawlers in on the canonical host", async () => {
    const result = await robotsFor("https://conpaws.com");
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.allow).toBe("/");
    expect(rule?.disallow).toEqual(["/api/", "/confirmed"]);
    expect(result.sitemap).toBe("https://conpaws.com/sitemap.xml");
  });

  it("asks a workers.dev preview not to be crawled at all", async () => {
    const result = await robotsFor("https://conpaws.mrdemonwolf.workers.dev");
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.disallow).toBe("/");
    expect(rule?.allow).toBeUndefined();
    // No sitemap either: pointing a preview's robots.txt at the real site's
    // URLs is how a preview gets crawled for content it does not own.
    expect(result.sitemap).toBeUndefined();
  });

  it("treats an unset site URL as a preview, not as production", async () => {
    // The regression this guards: the schema used to default to
    // https://conpaws.com, so an unset variable read as canonical and the
    // disallow branch could never run anywhere.
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { default: robots } = await import("./robots");
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.disallow).toBe("/");
  });
});
