import { describe, expect, it } from "vitest";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "./presentation-lock";

describe("presentation lock", () => {
  it("blocks a second synchronous presentation until reset", () => {
    const lock = { current: false };

    expect(tryAcquirePresentationLock(lock)).toBe(true);
    expect(tryAcquirePresentationLock(lock)).toBe(false);

    resetPresentationLock(lock);
    expect(tryAcquirePresentationLock(lock)).toBe(true);
  });
});
