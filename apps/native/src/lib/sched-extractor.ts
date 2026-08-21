import {
  InvalidScheduleUrlError,
  looksLikeCalendar,
  resolveScheduleUrl,
  type ScheduleUrlKind,
} from "./schedule-url";

export { InvalidScheduleUrlError } from "./schedule-url";

/** @deprecated Kept so existing catch blocks keep compiling. */
export class InvalidSchedUrlError extends Error {
  constructor(url: string) {
    super(
      `Invalid Sched URL: "${url}". Expected format: https://yourcon.sched.com`,
    );
    this.name = "InvalidSchedUrlError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

export interface FetchedSchedule {
  icsContent: string;
  /** Cleaned-up URL to persist for later refreshes. */
  canonicalUrl: string;
  kind: ScheduleUrlKind;
}

/**
 * Fetches a schedule from a Sched address, a direct .ics link, or a webcal
 * link. Resolution is delegated to `resolveScheduleUrl`, which also rejects
 * schemes that must never be fetched.
 */
export async function fetchScheduleIcs(url: string): Promise<FetchedSchedule> {
  const resolved = resolveScheduleUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(resolved.fetchUrl, {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
    });

    if (!response.ok) {
      throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`);
    }

    const body = await response.text();

    // Sniff the body rather than trusting Content-Type: plenty of hosts serve
    // .ics as text/plain or application/octet-stream, and a site that answers
    // an unknown path with a 200 HTML page would otherwise import as garbage.
    if (!looksLikeCalendar(body)) {
      const contentType = response.headers.get("content-type") ?? "unknown";
      throw new InvalidResponseError(
        `That link did not return a calendar (content-type: ${contentType}).`,
      );
    }

    return {
      icsContent: body,
      canonicalUrl: resolved.canonicalUrl,
      kind: resolved.kind,
    };
  } catch (err) {
    if (
      err instanceof InvalidScheduleUrlError ||
      err instanceof InvalidResponseError ||
      err instanceof NetworkError
    ) {
      throw err;
    }
    if ((err as Error).name === "AbortError") {
      throw new NetworkError("Request timed out after 30 seconds");
    }
    throw new NetworkError(`Network request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
}

/** @deprecated Use `fetchScheduleIcs`, which also accepts .ics and webcal. */
export async function fetchSchedIcs(url: string): Promise<string> {
  return (await fetchScheduleIcs(url)).icsContent;
}
