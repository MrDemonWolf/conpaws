import { beforeEach, describe, expect, it, vi } from "vitest";

const { storage, developerToolsEnabled } = vi.hoisted(() => ({
  storage: { getItem: vi.fn(), setItem: vi.fn() },
  developerToolsEnabled: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { appVariant: "development" } } },
}));
vi.mock("@/lib/developer-tools", () => ({ developerToolsEnabled }));
vi.mock("./fixture-source", () => ({
  fixtureCatalogSource: { kind: "fixture" },
}));
vi.mock("./source", () => ({ httpCatalogSource: { kind: "http" } }));

import {
  CATALOG_SOURCE_STORAGE_KEY,
  getCachedCatalogSourcePreference,
  primeCatalogSourcePreference,
  resolveCatalogSource,
  setCatalogSourcePreference,
} from "./source-preference";

describe("catalog source preference", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    developerToolsEnabled.mockReturnValue(true);
    await primeCatalogSourcePreference();
  });

  it("defaults to HTTP and primes the cached value from storage", async () => {
    expect(getCachedCatalogSourcePreference()).toBe("http");

    storage.getItem.mockResolvedValueOnce("fixture");
    await primeCatalogSourcePreference();

    expect(storage.getItem).toHaveBeenLastCalledWith(
      CATALOG_SOURCE_STORAGE_KEY,
    );
    expect(getCachedCatalogSourcePreference()).toBe("fixture");
  });

  it("persists the selection and only resolves fixtures when developer tools are enabled", async () => {
    await setCatalogSourcePreference("fixture");
    expect(storage.setItem).toHaveBeenCalledWith(
      CATALOG_SOURCE_STORAGE_KEY,
      "fixture",
    );
    expect(resolveCatalogSource(true).kind).toBe("fixture");

    developerToolsEnabled.mockReturnValue(false);
    expect(resolveCatalogSource(true).kind).toBe("http");
  });
});
