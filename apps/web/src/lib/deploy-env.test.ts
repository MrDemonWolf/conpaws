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
  LISTMONK_BASE_URL: "https://lists.example.com",
  LISTMONK_API_USER: "api-user",
  LISTMONK_API_TOKEN: "api-token",
  LISTMONK_LIST_ID: "3",
};

describe("readDeployEnv", () => {
  it("accepts a complete production environment", () => {
    expect(readDeployEnv(validEnv)).toMatchObject({
      NEXT_PUBLIC_SITE_URL: "https://conpaws.com",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key",
      LISTMONK_LIST_ID: 3,
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
});
