import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NetworkError,
  ScheduleFetchCancelledError,
} from "@/lib/sched-extractor";

const { fetchStreaming } = vi.hoisted(() => ({ fetchStreaming: vi.fn() }));

vi.mock("@/lib/bounded-response", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bounded-response")>()),
  fetchStreaming,
}));

import {
  CatalogNotFoundError,
  CatalogUnavailableError,
  catalogScheduleUrl,
  fetchCatalogList,
  fetchCatalogSchedule,
} from "./client";

const edition = {
  id: "edition-1",
  slug: "sample-con",
  name: "Sample Con",
  acronym: "SC",
  city: "Sample Harbor",
  region: "Sample Region",
  country: "Sample Country",
  startsOn: "2026-10-20",
  endsOn: "2026-10-22",
  timezone: "America/New_York",
  venue: "Sample Hall",
  availability: "unknown",
  scheduleStatus: "complete",
  revision: 1,
  sessions: [],
};

function response(status: number, body: unknown) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.useRealTimers();
  fetchStreaming.mockReset();
});

afterEach(() => vi.useRealTimers());

describe("catalog HTTP client", () => {
  it("fetches and validates the list with the JSON accept header", async () => {
    fetchStreaming.mockResolvedValue(
      response(200, { version: 1, conventions: [edition] }),
    );

    await expect(fetchCatalogList()).resolves.toEqual([edition]);
    expect(fetchStreaming).toHaveBeenCalledWith(
      "https://conpaws.com/api/v1/conventions",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("uses encoded slugs for schedule requests", async () => {
    fetchStreaming.mockResolvedValue(
      response(200, {
        version: 1,
        conventionId: "edition-1",
        slug: "sample/con",
        revision: 1,
        timezone: "America/New_York",
        status: "complete",
        sessions: [],
      }),
    );

    await fetchCatalogSchedule("sample/con");
    expect(catalogScheduleUrl("sample/con")).toBe(
      "https://conpaws.com/api/v1/conventions/sample%2Fcon/schedule",
    );
    expect(fetchStreaming.mock.calls[0][0]).toBe(
      catalogScheduleUrl("sample/con"),
    );
  });

  it("distinguishes not-found and unavailable responses", async () => {
    fetchStreaming.mockResolvedValueOnce(response(404, {}));
    await expect(fetchCatalogSchedule("missing")).rejects.toBeInstanceOf(
      CatalogNotFoundError,
    );

    fetchStreaming.mockResolvedValueOnce(response(503, {}));
    await expect(fetchCatalogList()).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );

    fetchStreaming.mockResolvedValueOnce(response(500, {}));
    await expect(fetchCatalogList()).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
  });

  it("rejects malformed JSON and response shapes", async () => {
    fetchStreaming.mockResolvedValueOnce(response(200, "{"));
    await expect(fetchCatalogList()).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );

    fetchStreaming.mockResolvedValueOnce(response(200, { version: 2 }));
    await expect(fetchCatalogList()).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );

    fetchStreaming.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(fetchCatalogList()).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
  });

  it("maps fetch failures and the 30 second timeout to NetworkError", async () => {
    fetchStreaming.mockRejectedValueOnce(new Error("network down"));
    await expect(fetchCatalogList()).rejects.toBeInstanceOf(NetworkError);

    vi.useFakeTimers();
    fetchStreaming.mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          }),
        ),
    );
    const pending = fetchCatalogList();
    const assertion = expect(pending).rejects.toBeInstanceOf(NetworkError);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it("treats caller cancellation separately from a network failure", async () => {
    fetchStreaming.mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          }),
        ),
    );
    const controller = new AbortController();
    const pending = fetchCatalogList({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ScheduleFetchCancelledError);
  });
});
