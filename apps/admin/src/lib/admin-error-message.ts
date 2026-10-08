const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  slug: "That URL slug is already in use. Choose a different short name.",
  missing:
    "That convention or schedule entry no longer exists. Reload the catalog and try again.",
};

export function adminErrorMessage(key: string) {
  return ADMIN_ERROR_MESSAGES[key] ?? null;
}
