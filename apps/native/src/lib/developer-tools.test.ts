import { describe, expect, it } from "vitest";
import { developerToolsEnabled } from "./developer-tools";

describe("developer tools gate", () => {
  it("only enables tools in a development bundle running dev JavaScript", () => {
    expect(developerToolsEnabled(true, "development")).toBe(true);
    expect(developerToolsEnabled(true, "preview")).toBe(false);
    expect(developerToolsEnabled(true, "production")).toBe(false);
    expect(developerToolsEnabled(false, "development")).toBe(false);
    expect(developerToolsEnabled(true, undefined)).toBe(false);
  });
});
