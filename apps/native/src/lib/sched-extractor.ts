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

const SCHED_PATTERN = /^https?:\/\/([a-zA-Z0-9-]+)\.sched\.com(\/.*)?$/;

export async function fetchSchedIcs(url: string): Promise<string> {
  const trimmed = url.trim();
  const match = trimmed.match(SCHED_PATTERN);

  if (!match) {
    throw new InvalidSchedUrlError(trimmed);
  }

  const subdomain = match[1];
  const icsUrl = `https://${subdomain}.sched.com/all.ics`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(icsUrl, { signal: controller.signal });

    if (!response.ok) {
      throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("text/calendar")) {
      throw new InvalidResponseError(
        `Expected text/calendar response, got: ${contentType}`,
      );
    }

    return await response.text();
  } catch (err) {
    if (
      err instanceof InvalidSchedUrlError ||
      err instanceof InvalidResponseError
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
