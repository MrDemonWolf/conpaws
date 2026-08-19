export function developerToolsEnabled(
  isDev: boolean,
  appVariant: unknown,
): boolean {
  return isDev && appVariant === "development";
}
