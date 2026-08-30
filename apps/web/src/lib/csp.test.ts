import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, securityHeaders } from "./csp";

describe("buildContentSecurityPolicy", () => {
  it("never allows eval outside development", () => {
    for (const env of ["production", "test", undefined, ""]) {
      expect(buildContentSecurityPolicy(env)).not.toContain("'unsafe-eval'");
    }
  });

  it("allows eval in development so React can build its stack traces", () => {
    expect(buildContentSecurityPolicy("development")).toContain(
      "'unsafe-eval'",
    );
  });

  // The physics badge that needed this was deleted in #29. The allowance
  // outlived it by one merge; it should not come back with it.
  it("does not allow WebAssembly compilation", () => {
    expect(buildContentSecurityPolicy("development")).not.toContain(
      "'wasm-unsafe-eval'",
    );
    expect(buildContentSecurityPolicy("production")).not.toContain(
      "'wasm-unsafe-eval'",
    );
  });

  it("keeps the directives the waitlist depends on", () => {
    const csp = buildContentSecurityPolicy("production");

    // Turnstile's script and its challenge iframe are separate directives;
    // losing either one silently breaks every real signup.
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    );
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  // Without this the offline worker fails to register and the site silently
  // loses offline reading — no error anyone would notice, because the page
  // still works perfectly for whoever is online enough to be looking at it.
  it("allows the offline service worker, from this origin only", () => {
    const csp = buildContentSecurityPolicy("production");

    expect(csp).toContain("worker-src 'self'");
    expect(csp).not.toContain("worker-src *");
  });
});

describe("securityHeaders", () => {
  it("ships HSTS without preload", () => {
    const hsts = securityHeaders("production").find(
      (header) => header.key === "Strict-Transport-Security",
    );

    expect(hsts?.value).toBe("max-age=63072000; includeSubDomains");
    expect(hsts?.value).not.toContain("preload");
  });

  it("carries the full header set", () => {
    expect(securityHeaders("production").map((header) => header.key)).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]);
  });
});
