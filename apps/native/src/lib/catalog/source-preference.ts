import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { fixtureCatalogSource } from "./fixture-source";
import { type CatalogSource, httpCatalogSource } from "./source";

export type CatalogSourceKind = "http" | "fixture";
export const CATALOG_SOURCE_STORAGE_KEY = "catalogSource";

let cachedSource: CatalogSourceKind = "http";

export async function primeCatalogSourcePreference(): Promise<void> {
  const stored = await AsyncStorage.getItem(CATALOG_SOURCE_STORAGE_KEY).catch(
    () => null,
  );
  cachedSource = stored === "fixture" ? "fixture" : "http";
}

export function getCachedCatalogSourcePreference(): CatalogSourceKind {
  return cachedSource;
}

export async function setCatalogSourcePreference(
  source: CatalogSourceKind,
): Promise<void> {
  cachedSource = source;
  await AsyncStorage.setItem(CATALOG_SOURCE_STORAGE_KEY, source).catch(
    () => undefined,
  );
}

export function resolveCatalogSource(
  isDev: boolean,
  appVariant: string | undefined = Constants.expoConfig?.extra?.appVariant,
): CatalogSource {
  return developerToolsEnabled(isDev, appVariant) && cachedSource === "fixture"
    ? fixtureCatalogSource
    : httpCatalogSource;
}
