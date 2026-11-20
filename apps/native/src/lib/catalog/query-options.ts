import { queryOptions } from "@tanstack/react-query";
import { CatalogUnavailableError } from "./client";
import type { CatalogSource } from "./source";

const CATALOG_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Retry only a server that answered badly, and only once.
 *
 * TanStack's client default is three retries, and React Native counts as a
 * client. Each catalog attempt can wait 30 seconds for its timeout, so a new
 * user on hotel Wi-Fi that has not passed its captive portal watched the
 * skeleton for about two minutes before the offline card and the Import and
 * Create fallback appeared. A NetworkError (offline, unreachable, timed out)
 * fails at once; Retry on the error card is the way to try again.
 */
export function catalogRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof CatalogUnavailableError;
}

/** The catalog list query both Find screens share, so they share its cache. */
export function catalogListQueryOptions(source: CatalogSource) {
  return queryOptions({
    queryKey: ["catalog", source.kind],
    queryFn: ({ signal }) => source.list(signal),
    staleTime: CATALOG_STALE_TIME_MS,
    retry: catalogRetry,
  });
}
