import { readDeployEnv } from "@conpaws/env/deploy";
import { describe, expect, it } from "vitest";

const validEnv = {
  CLOUDFLARE_API_TOKEN: "cloudflare-token",
  CLOUDFLARE_ACCOUNT_ID: "cloudflare-account",
  NEXT_PUBLIC_SITE_URL: "https://conpaws.com",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
  ALCHEMY_PASSWORD: "password",
  ALCHEMY_STATE_TOKEN: "state-token",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  WAITLIST_ACCEPTING_SIGNUPS: "true",
  LISTMONK_BASE_URL: "https://lists.mrdemonwolf.com",
  LISTMONK_API_USER: "api-user",
  LISTMONK_API_TOKEN: "api-token",
  LISTMONK_LIST_ID: "3",
  ROUTES_ENABLED: "false",
  WORKERS_DEV_ENABLED: "true",
  PREVIEW_URLS_ENABLED: "false",
};

describe("readDeployEnv", () => {
  it("accepts a complete production environment", () => {
    expect(readDeployEnv(validEnv)).toMatchObject({
      NEXT_PUBLIC_SITE_URL: "https://conpaws.com",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
      LISTMONK_LIST_ID: 3,
      ROUTES_ENABLED: false,
      WORKERS_DEV_ENABLED: true,
      PREVIEW_URLS_ENABLED: false,
    });
  });

  it.each(["http://localhost:3000", "https://127.0.0.1"])(
    "rejects local site URL %s",
    (url) => {
      expect(() =>
        readDeployEnv({ ...validEnv, NEXT_PUBLIC_SITE_URL: url }),
      ).toThrow(/NEXT_PUBLIC_SITE_URL/);
    },
  );

  it("requires the public Turnstile key and all listmonk settings", () => {
    const { NEXT_PUBLIC_TURNSTILE_SITE_KEY: _siteKey, ...missingSiteKey } =
      validEnv;
    expect(() => readDeployEnv(missingSiteKey)).toThrow(
      /NEXT_PUBLIC_TURNSTILE_SITE_KEY/,
    );
    const { LISTMONK_API_TOKEN: _token, ...missingListmonk } = validEnv;
    expect(() => readDeployEnv(missingListmonk)).toThrow(/LISTMONK_API_TOKEN/);
  });

  it.each([
    "http://lists.mrdemonwolf.com",
    "https://user:password@lists.mrdemonwolf.com",
    "https://lists.example.com",
    "https://lists.mrdemonwolf.com/api",
  ])("rejects unsafe listmonk production URL %s", (url) => {
    expect(() =>
      readDeployEnv({ ...validEnv, LISTMONK_BASE_URL: url }),
    ).toThrow(/LISTMONK_BASE_URL/);
  });

  it.each([
    "ROUTES_ENABLED",
    "WORKERS_DEV_ENABLED",
    "PREVIEW_URLS_ENABLED",
  ] as const)("requires an explicit true or false for %s", (name) => {
    const { [name]: _value, ...missing } = validEnv;
    expect(() => readDeployEnv(missing)).toThrow(name);
    expect(() => readDeployEnv({ ...validEnv, [name]: "yes" })).toThrow(name);
    expect(() => readDeployEnv({ ...validEnv, [name]: "TRUE" })).toThrow(name);
  });

  it("requires either a custom route or workers.dev URL", () => {
    expect(() =>
      readDeployEnv({
        ...validEnv,
        ROUTES_ENABLED: "false",
        WORKERS_DEV_ENABLED: "false",
      }),
    ).toThrow(/ROUTES_ENABLED or WORKERS_DEV_ENABLED must be true/);
  });
});
