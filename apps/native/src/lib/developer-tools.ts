export function developerToolsEnabled(
  isDev: boolean,
  appVariant: unknown,
): boolean {
  return appVariant === "preview" || (isDev && appVariant === "development");
}

export type ConventionPreviewState =
  | "loading"
  | "empty"
  | "error"
  | "content"
  | "plan"
  | "interested"
  | "now-next";

export function resolveConventionPreviewState(
  value: unknown,
  isDev: boolean,
  appVariant: unknown,
): ConventionPreviewState | null {
  if (!developerToolsEnabled(isDev, appVariant)) return null;

  return value === "loading" ||
    value === "empty" ||
    value === "error" ||
    value === "content" ||
    value === "plan" ||
    value === "interested" ||
    value === "now-next"
    ? value
    : null;
}
