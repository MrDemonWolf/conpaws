import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap hreflang alternates", () => {
  it("uses absolute site URLs for every language alternate", () => {
    const landing = sitemap().find((entry) => entry.url.endsWith("/"));
    const languages = landing?.alternates?.languages;

    expect(languages).toBeDefined();
    for (const url of Object.values(languages ?? {})) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});
