import {
  fetchStreaming,
  ResponseTooLargeError,
  readResponseTextWithLimit,
} from "@/lib/bounded-response";
import {
  NetworkError,
  ScheduleFetchCancelledError,
} from "@/lib/sched-extractor";
import { catalogBaseUrl } from "./base-url";
import {
  type CatalogEdition,
  type CatalogSchedule,
  isCatalogListResponse,
  isCatalogScheduleResponse,
} from "./types";

const MAX_CATALOG_BYTES = 4 * 1024 * 1024;
const CATALOG_TIMEOUT_MS = 30_000;

export class CatalogUnavailableError extends Error {
  constructor(message = "ConPaws catalog is unavailable") {
    super(message);
    this.name = "CatalogUnavailableError";
  }
}

export class CatalogNotFoundError extends Error {
  constructor() {
    super("Convention is not in the catalog");
    this.name = "CatalogNotFoundError";
  }
}

export function catalogScheduleUrl(slug: string): string {
  return `${catalogBaseUrl()}/v1/conventions/${encodeURIComponent(slug)}/schedule`;
}

async function fetchCatalogJson<T>(
  url: string,
  validate: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw new ScheduleFetchCancelledError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller);

  try {
    const response = await fetchStreaming(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) throw new CatalogNotFoundError();
    if (!response.ok) {
      throw new CatalogUnavailableError(
        `Catalog request failed (${response.status})`,
      );
    }
    if (!response.body) {
      throw new CatalogUnavailableError("Catalog response had no body");
    }

    let body: string;
    try {
      body = await readResponseTextWithLimit(response, MAX_CATALOG_BYTES);
    } catch (error) {
      if (error instanceof ResponseTooLargeError) {
        throw new CatalogUnavailableError("Catalog response exceeded 4 MB");
      }
      throw error;
    }

    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      throw new CatalogUnavailableError("Catalog returned invalid JSON");
    }
    if (!validate(value)) {
      throw new CatalogUnavailableError(
        "Catalog response did not match its schema",
      );
    }
    return value;
  } catch (error) {
    if (
      error instanceof CatalogNotFoundError ||
      error instanceof CatalogUnavailableError ||
      error instanceof ScheduleFetchCancelledError ||
      error instanceof NetworkError
    ) {
      throw error;
    }
    if ((error as Error)?.name === "AbortError") {
      if (signal?.aborted) throw new ScheduleFetchCancelledError();
      throw new NetworkError("Catalog request timed out after 30 seconds");
    }
    if (controller.signal.aborted && signal?.aborted) {
      throw new ScheduleFetchCancelledError();
    }
    throw new NetworkError(
      `Catalog request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function fetchCatalogList(
  options: { signal?: AbortSignal } = {},
): Promise<CatalogEdition[]> {
  const response = await fetchCatalogJson(
    `${catalogBaseUrl()}/v1/conventions`,
    isCatalogListResponse,
    options.signal,
  );
  return response.conventions;
}

export function fetchCatalogSchedule(
  slug: string,
  options: { signal?: AbortSignal } = {},
): Promise<CatalogSchedule> {
  return fetchCatalogJson(
    catalogScheduleUrl(slug),
    isCatalogScheduleResponse,
    options.signal,
  );
}
