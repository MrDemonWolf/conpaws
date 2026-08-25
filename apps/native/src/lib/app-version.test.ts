import { describe, expect, it } from "vitest";
import { formatVersionLabel } from "./app-version";

describe("formatVersionLabel", () => {
  it("appends the build number when there is one", () => {
    expect(formatVersionLabel("1.0.0", "42")).toBe("1.0.0 (42)");
  });

  it("falls back to the bare version when the build number is missing", () => {
    expect(formatVersionLabel("1.0.0", null)).toBe("1.0.0");
    expect(formatVersionLabel("1.0.0", undefined)).toBe("1.0.0");
  });

  it("treats a blank build number as missing", () => {
    expect(formatVersionLabel("1.0.0", "")).toBe("1.0.0");
    expect(formatVersionLabel("1.0.0", "   ")).toBe("1.0.0");
  });

  it("trims a padded build number rather than printing the padding", () => {
    expect(formatVersionLabel("1.0.0", " 42 ")).toBe("1.0.0 (42)");
  });
});
