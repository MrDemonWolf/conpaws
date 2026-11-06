import { describe, expect, it, vi } from "vitest";
import { BADGE_NAME_MAX_LENGTH, limitBadgeName } from "./badge-name";

describe("badge name length", () => {
  it("preserves names and fursonas within the shared field's ceiling", () => {
    for (const name of ["", "Luna Starfall", "Kodiak 2", "O’Paws", "雪の狼"]) {
      expect(limitBadgeName(name)).toBe(name);
    }
    expect(limitBadgeName("W".repeat(32))).toHaveLength(32);
    expect(BADGE_NAME_MAX_LENGTH).toBe(32);
  });

  it("caps long pasted or programmatic values at the native input limit", () => {
    expect(limitBadgeName("W".repeat(10_000))).toBe("W".repeat(32));
    expect(limitBadgeName("雪".repeat(40))).toBe("雪".repeat(32));
  });

  it("never splits supplementary letters or surrogate pairs", () => {
    expect(limitBadgeName(`${"a".repeat(31)}𐐀`)).toBe("a".repeat(31));
    expect(limitBadgeName("𐐀".repeat(20))).toBe("𐐀".repeat(16));
    expect(limitBadgeName("🦊".repeat(20))).toBe("🦊".repeat(16));
  });

  it("keeps combining marks and joined characters together", () => {
    expect(limitBadgeName(`${"a".repeat(31)}e\u0301`)).toBe("a".repeat(31));
    const family = "👩‍👩‍👧‍👦";
    expect(limitBadgeName(family.repeat(4))).toBe(family.repeat(2));
    expect(limitBadgeName(`e${"\u0301".repeat(32)}`)).toBe("");
  });

  it("uses the remaining budget when pasting into an existing name", () => {
    const before = "Luna ";
    const after = " Wolf";
    const pasted = limitBadgeName(
      "𐐀".repeat(20),
      BADGE_NAME_MAX_LENGTH - before.length - after.length,
    );
    expect(`${before}${pasted}${after}`).toBe(`Luna ${"𐐀".repeat(11)} Wolf`);
    expect(limitBadgeName("Paws", 0)).toBe("");
  });

  it("matches single-line input state and discards malformed surrogate input", () => {
    expect(limitBadgeName("Luna\r\nStarfall")).toBe("LunaStarfall");
    expect(limitBadgeName("Luna\ud83d Wolf")).toBe("Luna Wolf");
    expect(limitBadgeName("\udc00Paws")).toBe("Paws");
  });

  it("imports and limits input when newer Unicode APIs are unavailable", async () => {
    const wellFormed = Object.getOwnPropertyDescriptor(
      String.prototype,
      "isWellFormed",
    );
    vi.stubGlobal(
      "Intl",
      Object.assign(Object.create(Intl), { Segmenter: undefined }),
    );
    Object.defineProperty(String.prototype, "isWellFormed", {
      configurable: true,
      value: undefined,
    });
    vi.resetModules();
    try {
      const fallback = await import("./badge-name");
      expect(fallback.limitBadgeName("Luna Starfall")).toBe("Luna Starfall");
      expect(fallback.limitBadgeName("W".repeat(40))).toHaveLength(32);
      expect(fallback.limitBadgeName(`${"a".repeat(31)}𐐀`)).toBe(
        "a".repeat(31),
      );
      expect(fallback.limitBadgeName("𐐀".repeat(20))).toBe("𐐀".repeat(16));
      expect(fallback.limitBadgeName("Luna\ud83d Wolf")).toBe("Luna Wolf");
    } finally {
      vi.unstubAllGlobals();
      if (wellFormed) {
        Object.defineProperty(String.prototype, "isWellFormed", wellFormed);
      } else {
        Reflect.deleteProperty(String.prototype, "isWellFormed");
      }
      vi.resetModules();
    }
  });
});
