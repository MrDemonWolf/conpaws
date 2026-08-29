import { useEffect, useState } from "react";

/**
 * A loading state that is only visible once loading has lasted long enough to
 * be worth showing.
 *
 * ConPaws reads from local SQLite, so most loads finish in well under a tenth
 * of a second. Rendering a skeleton for those makes the screen flicker, which
 * reads as a glitch rather than as progress -- the usability guidance is to show
 * no loading state at all below roughly a second, because a placeholder that
 * appears and vanishes is worse than one that never appeared. Waiting out this
 * delay means fast loads go straight from nothing to content, and only genuinely
 * slow ones (a large ICS import, a cold start on a tired phone) get a skeleton.
 *
 * The app's loading language, in full:
 * 1. Under this delay: nothing — a background-colored view.
 * 2. Past it, for a screen's first paint: a skeleton (Skeleton.tsx).
 * 3. For a user-initiated operation of unknown length (import fetch/parse,
 *    export): a native ActivityIndicator on the row that describes the work.
 * There is deliberately no pull-to-refresh anywhere: every list reads local
 * SQLite, so there is nothing remote to refresh and the gesture would be a
 * fake affordance that spins and changes nothing.
 */
const DEFAULT_DELAY_MS = 250;

export function useDelayedLoading(
  isLoading: boolean,
  delayMs: number = DEFAULT_DELAY_MS,
): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsVisible(false);
      return;
    }
    const timer = setTimeout(() => setIsVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [isLoading, delayMs]);

  return isLoading && isVisible;
}
