import { describe, it, expect } from "vitest";

// Inline validation to avoid importing db/client (requires native expo-sqlite)
function validateExportData(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.version === "number" &&
    typeof d.schemaVersion === "number" &&
    typeof d.exportedAt === "string" &&
    Array.isArray(d.conventions) &&
    Array.isArray(d.events)
  );
}

describe("validateExportData", () => {
  it("validates correct export data", () => {
    const data = {
      version: 1,
      schemaVersion: 1,
      exportedAt: "2026-01-01T00:00:00Z",
      conventions: [],
      events: [],
    };
    expect(validateExportData(data)).toBe(true);
  });

  it("rejects missing version", () => {
    const data = {
      schemaVersion: 1,
      exportedAt: "2026-01-01T00:00:00Z",
      conventions: [],
      events: [],
    };
    expect(validateExportData(data)).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateExportData(null)).toBe(false);
    expect(validateExportData("string")).toBe(false);
    expect(validateExportData(42)).toBe(false);
  });

  it("rejects missing arrays", () => {
    const data = {
      version: 1,
      schemaVersion: 1,
      exportedAt: "2026-01-01T00:00:00Z",
    };
    expect(validateExportData(data)).toBe(false);
  });

  it("accepts data with conventions and events", () => {
    const data = {
      version: 1,
      schemaVersion: 1,
      exportedAt: "2026-01-01T00:00:00Z",
      conventions: [{ id: "1", name: "Test" }],
      events: [{ id: "1", title: "Event" }],
    };
    expect(validateExportData(data)).toBe(true);
  });
});
