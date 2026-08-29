/**
 * Guards against double-presenting a pushed screen from a double-tap.
 *
 * The lock is a timestamp, not a boolean, because the boolean version had a
 * real failure mode: it was released only by a `useFocusEffect`, and when a
 * pushed formSheet dismissed without a JS focus event refiring, the lock stayed
 * held forever. Every button behind it then silently no-oped until the user
 * switched tabs — a screen full of dead buttons with no error anywhere.
 *
 * With a timestamp the lock self-heals: an acquire only blocks while it is
 * younger than the expiry, which just needs to outlive the push transition.
 * The focus-effect reset stays as the fast path so rapid open→back→open flows
 * are never throttled.
 */

/**
 * How long an acquire blocks the next one. The native push transition is
 * ~500ms; 700 covers it with margin while keeping a stuck lock's blast radius
 * under a second.
 */
export const PRESENTATION_LOCK_EXPIRY_MS = 700;

interface PresentationLock {
  /** 0 when free, otherwise the timestamp of the acquisition. */
  current: number;
}

export function tryAcquirePresentationLock(
  lock: PresentationLock,
  now = Date.now(),
): boolean {
  if (lock.current !== 0 && now - lock.current < PRESENTATION_LOCK_EXPIRY_MS) {
    return false;
  }
  lock.current = now;
  return true;
}

export function resetPresentationLock(lock: PresentationLock): void {
  lock.current = 0;
}
