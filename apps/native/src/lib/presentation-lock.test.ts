import { describe, expect, it } from "vitest";
import {
  PRESENTATION_LOCK_EXPIRY_MS,
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "./presentation-lock";

describe("presentation lock", () => {
  it("blocks a second acquire within the expiry window", () => {
    const lock = { current: 0 };

    expect(tryAcquirePresentationLock(lock, 1000)).toBe(true);
    expect(tryAcquirePresentationLock(lock, 1001)).toBe(false);
    expect(
      tryAcquirePresentationLock(lock, 1000 + PRESENTATION_LOCK_EXPIRY_MS - 1),
    ).toBe(false);
  });

  it("self-heals: grants after the expiry without any reset", () => {
    const lock = { current: 0 };

    expect(tryAcquirePresentationLock(lock, 1000)).toBe(true);
    expect(
      tryAcquirePresentationLock(lock, 1000 + PRESENTATION_LOCK_EXPIRY_MS),
    ).toBe(true);
  });

  it("reset frees the lock immediately", () => {
    const lock = { current: 0 };

    expect(tryAcquirePresentationLock(lock, 1000)).toBe(true);
    resetPresentationLock(lock);
    expect(lock.current).toBe(0);
    expect(tryAcquirePresentationLock(lock, 1001)).toBe(true);
  });
});
