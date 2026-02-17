const SCHED_URL_PATTERN = /^https?:\/\/([a-z0-9-]+)\.sched\.com\/?$/i;

export function isValidSchedUrl(url: string): boolean {
  return SCHED_URL_PATTERN.test(url.trim());
}

export function getSchedIcsUrl(schedUrl: string): string {
  const match = schedUrl.trim().match(SCHED_URL_PATTERN);
  if (!match) throw new Error("Invalid Sched URL");
  const slug = match[1];
  return `https://${slug}.sched.com/all.ics`;
}

export async function fetchSchedIcs(
  schedUrl: string,
  timeoutMs = 15000,
): Promise<string> {
  const icsUrl = getSchedIcsUrl(schedUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(icsUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule: ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
