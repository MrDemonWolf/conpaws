import { describe, expect, it } from "vitest";
import { previewIndexForKey } from "./app-preview";

describe("app preview keyboard selection", () => {
  it("wraps arrow navigation and keeps ordinary keys available to the browser", () => {
    expect(previewIndexForKey(0, 3, "ArrowLeft")).toBe(2);
    expect(previewIndexForKey(2, 3, "ArrowRight")).toBe(0);
    expect(previewIndexForKey(1, 3, "Home")).toBe(0);
    expect(previewIndexForKey(1, 3, "End")).toBe(2);
    expect(previewIndexForKey(1, 3, "Tab")).toBeNull();
    expect(previewIndexForKey(0, 0, "ArrowRight")).toBeNull();
  });
});
