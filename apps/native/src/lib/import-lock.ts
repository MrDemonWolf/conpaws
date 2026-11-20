/**
 * Lets a screen run one schedule import at a time, and none after one lands.
 *
 * `@expo/ui`'s Button applies `disabled` only as a native modifier and still
 * calls `onPress`, so a second tap that lands before React commits the
 * disabled state runs the handler again -- the closure React last committed,
 * whose preview is still set. On a new convention that wrote the whole
 * schedule twice, into two conventions.
 *
 * So the lock is a ref, taken synchronously before anything awaits. It frees
 * when an attempt writes nothing, so the user can fix the problem and try
 * again, but stays held once one lands: that preview is spent, and a tap still
 * queued behind it must not write it a second time.
 */
export interface ImportLock {
  current: boolean;
}

/**
 * Runs `attempt` unless another holds the lock. `attempt` resolves true once
 * its write has landed.
 *
 * Resolves to what `attempt` returned, or false when the tap was dropped.
 */
export async function runImportOnce(
  lock: ImportLock,
  attempt: () => Promise<boolean>,
): Promise<boolean> {
  if (lock.current) return false;
  lock.current = true;
  let landed = false;
  try {
    landed = await attempt();
    return landed;
  } finally {
    if (!landed) lock.current = false;
  }
}
