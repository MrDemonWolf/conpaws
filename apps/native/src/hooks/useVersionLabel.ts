import * as Application from "expo-application";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { formatVersionLabel } from "@/lib/app-version";

/**
 * The one place the app decides how its version reads, so Settings and About
 * cannot drift apart.
 *
 * `nativeBuildVersion` is the build number of the binary that is actually
 * running -- iOS `CFBundleVersion`, Android `versionCode` -- rather than
 * whatever `app.config.ts` happened to say when the bundle was made. That
 * distinction matters here: local builds take it from `BUILD_NUMBER` in
 * `app.config.ts`, and release CI assigns its own number in a temporary
 * checkout that is never committed, so the config in the repo can lag the
 * running binary.
 */
export function useVersionLabel(): string {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? "0.0.0";

  return t("common.version", {
    version: formatVersionLabel(version, Application.nativeBuildVersion),
  });
}
