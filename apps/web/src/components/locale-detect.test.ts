import { describe, expect, it } from "vitest";
import { storedLocaleTarget } from "./locale-detect";

describe("storedLocaleTarget", () => {
  const available = ["en", "es-419", "pt-BR"];

  it("returns a valid stored choice", () => {
    expect(storedLocaleTarget("pt-BR", available)).toBe("pt-BR");
  });

  it("ignores missing and unpublished choices", () => {
    expect(storedLocaleTarget(null, available)).toBeNull();
    expect(storedLocaleTarget("fr", available)).toBeNull();
  });
});
