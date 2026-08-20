import { describe, expect, it } from "vitest";
import {
  developerToolsEnabled,
  resolveConventionPreviewState,
} from "./developer-tools";

describe("developer tools gate", () => {
  it("only enables tools in a development bundle running dev JavaScript", () => {
    expect(developerToolsEnabled(true, "development")).toBe(true);
    expect(developerToolsEnabled(true, "preview")).toBe(false);
    expect(developerToolsEnabled(true, "production")).toBe(false);
    expect(developerToolsEnabled(false, "development")).toBe(false);
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
    expect(
      resolveConventionPreviewState("unknown", true, "development"),
    ).toBeNull();
    expect(
      resolveConventionPreviewState(["loading"], true, "development"),
    ).toBeNull();
  });
});
