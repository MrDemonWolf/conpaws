import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type WorkerEvent = {
  request?: { method: string; mode: string; url: string };
  respondWith?: (response: Promise<Response>) => void;
  waitUntil?: (promise: Promise<unknown>) => void;
};

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);

function createWorker(fetchRequest: (request: unknown) => Promise<Response>) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const cache = { addAll: vi.fn(async () => undefined) };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => [] as string[]),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => undefined as Response | undefined),
  };
  const self = {
    location: { origin: "https://admin.conpaws.com" },
    addEventListener: (
      type: string,
      listener: (event: WorkerEvent) => void,
    ) => {
      listeners.set(type, listener);
    },
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };

  runInNewContext(source, { self, caches, fetch: fetchRequest, URL, Response });

  return { listeners, cache, caches, self };
}

describe("admin service worker", () => {
  it("precaches only public PWA assets, never admin pages or private data", async () => {
    const worker = createWorker(vi.fn(async () => new Response("network")));
    let installWork: Promise<unknown> | undefined;
    worker.listeners.get("install")?.({
      waitUntil: (promise) => {
        installWork = promise;
      },
    });

    await installWork;

    expect(worker.cache.addAll).toHaveBeenCalledWith([
      "/offline.html",
      "/manifest.webmanifest",
      "/pwa-icon-192.png",
      "/pwa-icon-512.png",
      "/apple-touch-icon.png",
    ]);
  });

  it("serves admin pages from the network and uses only the offline shell when it fails", async () => {
    const offlinePage = new Response("offline shell", { status: 200 });
    const fetchRequest = vi.fn().mockRejectedValue(new TypeError("offline"));
    const worker = createWorker(fetchRequest);
    worker.caches.match.mockResolvedValue(offlinePage);
    let navigationResponse: Promise<Response> | undefined;

    worker.listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://admin.conpaws.com/conventions/private-id",
      },
      respondWith: (response) => {
        navigationResponse = response;
      },
    });

    expect(await navigationResponse).toBe(offlinePage);
    expect(fetchRequest).toHaveBeenCalledOnce();
    expect(worker.caches.match).toHaveBeenCalledWith("/offline.html");
  });

  it("does not intercept server-action POSTs or private API requests", () => {
    const fetchRequest = vi.fn();
    const worker = createWorker(fetchRequest);
    const respondWith = vi.fn();
    const handleFetch = worker.listeners.get("fetch");

    handleFetch?.({
      request: {
        method: "POST",
        mode: "cors",
        url: "https://admin.conpaws.com/conventions/action",
      },
      respondWith,
    });
    handleFetch?.({
      request: {
        method: "GET",
        mode: "cors",
        url: "https://admin.conpaws.com/api/private",
      },
      respondWith,
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
    expect(worker.caches.match).not.toHaveBeenCalled();
  });

  it("deletes only prior caches owned by this admin shell", async () => {
    const worker = createWorker(vi.fn(async () => new Response("network")));
    worker.caches.keys.mockResolvedValue([
      "conpaws-admin-offline-v0",
      "other-app-cache",
    ]);
    let activationWork: Promise<unknown> | undefined;
    worker.listeners.get("activate")?.({
      waitUntil: (promise) => {
        activationWork = promise;
      },
    });

    await activationWork;

    expect(worker.caches.delete).toHaveBeenCalledOnce();
    expect(worker.caches.delete).toHaveBeenCalledWith(
      "conpaws-admin-offline-v0",
    );
    expect(worker.self.clients.claim).toHaveBeenCalledOnce();
  });
});
