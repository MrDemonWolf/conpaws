import { fetchCatalogList, fetchCatalogSchedule } from "./client";
import type { CatalogEdition, CatalogSchedule } from "./types";

export interface CatalogSource {
  kind: "http" | "fixture";
  list(signal?: AbortSignal): Promise<CatalogEdition[]>;
  schedule(slug: string, signal?: AbortSignal): Promise<CatalogSchedule>;
}

export const httpCatalogSource: CatalogSource = {
  kind: "http",
  list: (signal) => fetchCatalogList({ signal }),
  schedule: (slug, signal) => fetchCatalogSchedule(slug, { signal }),
};
