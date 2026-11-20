import { readFileSync } from "node:fs";
import path from "node:path";
import {
  environmentManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NetworkError } from "@/lib/sched-extractor";
import { CatalogNotFoundError, CatalogUnavailableError } from "./client";
import { catalogListQueryOptions, catalogRetry } from "./query-options";
import type { CatalogSource } from "./source";

describe("catalogRetry", () => {
  it("gives up at once when the device cannot reach the catalog", () => {
    // Offline, a captive portal and the 30-second timeout all arrive as a
    // NetworkError. Retrying them only keeps a new user on the skeleton.
    expect(catalogRetry(0, new NetworkError("offline"))).toBe(false);
  });

  it("tries a failing server once more", () => {
    expect(catalogRetry(0, new CatalogUnavailableError())).toBe(true);
    expect(catalogRetry(1, new CatalogUnavailableError())).toBe(false);
  });

  it("does not retry a catalog that is not there", () => {
    expect(catalogRetry(0, new CatalogNotFoundError())).toBe(false);
  });
});

describe("catalog list query", () => {
  // Vitest runs in Node, where there is no `window`, so TanStack treats it as
  // a server and defaults `retry` to 0. React Native defines `window`, so the
  // app got the client default instead: three retries after 1, 2 and 4
  // seconds, each waiting up to 30 seconds for its own timeout. Test what the
  // phone does, not what Node does.
  const wasServer = environmentManager.isServer();
  beforeAll(() => environmentManager.setIsServer(() => false));
  afterAll(() => environmentManager.setIsServer(() => wasServer));
  afterEach(() => vi.useRealTimers());

  function observe(list: CatalogSource["list"]) {
    const client = new QueryClient();
    const observer = new QueryObserver(
      client,
      catalogListQueryOptions({ kind: "http", list, schedule: vi.fn() }),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    return {
      observer,
      done: () => {
        unsubscribe();
        client.clear();
      },
    };
  }

  it("shows the offline state after one attempt instead of waiting through retries", async () => {
    vi.useFakeTimers();
    const list = vi.fn().mockRejectedValue(new NetworkError("offline"));
    const { observer, done } = observe(list);

    // Well short of the first default retry delay of one second.
    await vi.advanceTimersByTimeAsync(500);
    expect(observer.getCurrentResult().isError).toBe(true);
    expect(observer.getCurrentResult().isLoading).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(list).toHaveBeenCalledTimes(1);
    done();
  });

  it("tries a failing server once more before showing the error", async () => {
    vi.useFakeTimers();
    const list = vi.fn().mockRejectedValue(new CatalogUnavailableError());
    const { observer, done } = observe(list);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(list).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().isError).toBe(true);
    done();
  });
});

describe("catalog screens", () => {
  it.each([
    ["Find a convention", "../../../app/(tabs)/(home)/convention/find.tsx"],
    ["catalog detail", "../../../app/(tabs)/(home)/convention/find/[slug].tsx"],
  ])("%s loads the list with the shared options", (_name, file) => {
    const screen = readFileSync(path.resolve(__dirname, file), "utf8");
    expect(screen).toContain("useQuery(catalogListQueryOptions(source))");
    expect(screen).not.toMatch(/queryKey:\s*\["catalog"/);
  });
});
