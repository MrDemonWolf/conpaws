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

/**
 * Largest schedule this will pull down.
 *
 * A whole convention's ICS is a few hundred KB; the largest real feed in
 * test-data is well under a megabyte. 8MB is generous for a legitimate
 * schedule and still small enough that a hostile or broken URL cannot make
 * the app buffer the device out of memory.
 *
 * ponytail: Content-Length is checked first, then the decoded body. React
 * Native's fetch has no dependable streaming reader, so a chunked response
 * that lies about its length is still buffered once before it is rejected.
 * If that ever matters, move this to an expo-file-system download with a
 * progress callback and abort mid-transfer.
 */
export const MAX_ICS_BYTES = 8 * 1024 * 1024;

export class ScheduleTooLargeError extends Error {
  constructor(bytes: number) {
    super(
      `That schedule is too large to import (${Math.round(bytes / 1024 / 1024)}MB).`,
    );
    this.name = "ScheduleTooLargeError";
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

    // Refuse before reading when the server is honest about the size.
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_ICS_BYTES) {
      throw new ScheduleTooLargeError(declared);
    }

    const body = await response.text();

    // Character count, not byte count. A UTF-8 body always has at least as
    // many bytes as characters, so this can only under-reject — by at most 4x
    // on a body made entirely of 4-byte characters, which is still a hard
    // bound. It avoids re-encoding 8MB just to measure it, and avoids betting
    // on Blob or TextEncoder being present on Hermes.
    if (body.length > MAX_ICS_BYTES) {
      throw new ScheduleTooLargeError(body.length);
    }

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
      err instanceof ScheduleTooLargeError ||
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
