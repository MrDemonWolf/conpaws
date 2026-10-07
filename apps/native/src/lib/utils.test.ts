import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps iOS text-style sizes next to text colors", () => {
    expect(
      cn("text-largeTitle font-bold text-foreground", "text-primary"),
    ).toBe("text-largeTitle font-bold text-primary");
    expect(cn("text-footnote text-muted-foreground", "text-center")).toBe(
      "text-footnote text-muted-foreground text-center",
    );
  });

  it("still lets a later size replace an earlier one", () => {
    expect(cn("text-body", "text-footnote")).toBe("text-footnote");
    expect(cn("text-subheadline", "text-sm")).toBe("text-sm");
  });
});
