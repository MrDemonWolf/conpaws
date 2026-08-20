import { describe, expect, it } from "vitest";
import {
  developerToolsEnabled,
  resolveConventionPreviewState,
} from "./developer-tools";

describe("developer tools gate", () => {
  it("enables tools in development and standalone preview bundles", () => {
    expect(developerToolsEnabled(true, "development")).toBe(true);
    expect(developerToolsEnabled(false, "development")).toBe(false);
    expect(developerToolsEnabled(true, "preview")).toBe(true);
    expect(developerToolsEnabled(false, "preview")).toBe(true);
    expect(developerToolsEnabled(true, "production")).toBe(false);
    expect(developerToolsEnabled(false, "production")).toBe(false);
    expect(developerToolsEnabled(true, undefined)).toBe(false);
  });

  it("accepts known convention state previews only behind the developer gate", () => {
    for (const state of ["loading", "empty", "error", "content"]) {
      expect(resolveConventionPreviewState(state, true, "development")).toBe(
        state,
      );
    }

    expect(
      resolveConventionPreviewState("loading", true, "production"),
    ).toBeNull();
    expect(resolveConventionPreviewState("loading", false, "preview")).toBe(
      "loading",
    );
    expect(
      resolveConventionPreviewState("unknown", true, "development"),
    ).toBeNull();
    expect(
      resolveConventionPreviewState(["loading"], true, "development"),
    ).toBeNull();
  });
});
