import { describe, expect, it } from "vitest";
import { validateLaunch } from "./launch";

describe("launch configuration", () => {
  it("allows waitlist without listings and refuses incomplete live mode", () => {
    expect(() =>
      validateLaunch({ mode: "waitlist", appStoreUrl: "", googlePlayUrl: "" }),
    ).not.toThrow();
    expect(() =>
      validateLaunch({ mode: "live", appStoreUrl: "", googlePlayUrl: "" }),
    ).toThrow("apps.apple.com");
    expect(() =>
      validateLaunch({
        mode: "live",
        appStoreUrl: "https://apps.apple.com/app/id123",
        googlePlayUrl: "https://play.google.com/store/apps/details?id=example",
      }),
    ).not.toThrow();
    expect(() =>
      validateLaunch({
        mode: "live",
        appStoreUrl: "https://example.com",
        googlePlayUrl: "https://play.google.com/store/apps/details?id=example",
      }),
    ).toThrow();
  });
});
