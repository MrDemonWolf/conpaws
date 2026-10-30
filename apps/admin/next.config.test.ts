import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";
import { adminSecurityHeaders } from "./src/lib/security-headers";

function byName(headers: ReturnType<typeof adminSecurityHeaders>) {
  return Object.fromEntries(headers.map(({ key, value }) => [key, value]));
}

describe("admin response headers", () => {
  it("applies the production policy to every route and hides Next.js", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.images?.unoptimized).toBe(true);

    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.source).toBe("/:path*");
    expect(byName(rules?.[0]?.headers ?? [])).toEqual(
      byName(adminSecurityHeaders("production")),
    );
  });

  it("permits only the extra connections and evaluation required by local HMR", () => {
    const production = byName(adminSecurityHeaders("production"));
    const development = byName(adminSecurityHeaders("development"));

    expect(production["Content-Security-Policy"]).not.toContain(
      "'unsafe-eval'",
    );
    expect(production["Content-Security-Policy"]).not.toContain("ws:");
    expect(development["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(development["Content-Security-Policy"]).toContain("ws: wss:");
  });
});
