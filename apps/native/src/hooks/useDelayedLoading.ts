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
