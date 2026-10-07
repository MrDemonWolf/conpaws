import { describe, expect, it } from "vitest";
import { launchForPreview, validateLaunch } from "./launch";

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

  it("requires a UTC target for countdown mode", () => {
    expect(() =>
      validateLaunch({
        mode: "coming-soon",
        appStoreUrl: "",
        googlePlayUrl: "",
      }),
    ).toThrow("NEXT_PUBLIC_COUNTDOWN_AT");
    expect(() =>
      validateLaunch({
        mode: "coming-soon",
        appStoreUrl: "",
        googlePlayUrl: "",
        countdownAt: "2026-12-01T18:00:00Z",
      }),
    ).not.toThrow();
  });

  it("lets the homepage preview live mode without publishing store links", () => {
    const preview = launchForPreview("live");
    expect(preview.mode).toBe("live");
    expect(preview.appStoreUrl).toBe("");
    expect(launchForPreview("maintenance").mode).toBe("waitlist");
  });
});
