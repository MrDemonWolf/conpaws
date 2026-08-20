export function getSentryOptions(isDev: boolean, dsn: string | undefined) {
  const configuredDsn = dsn?.trim();
  if (isDev || !configuredDsn) {
    return null;
  }

  try {
    const url = new URL(configuredDsn);
    const projectId = url.pathname.split("/").filter(Boolean).at(-1);
    if (
      url.protocol !== "https:" ||
      !url.username ||
      !url.hostname ||
      !projectId ||
      !/^\d+$/.test(projectId)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    dsn: configuredDsn,
    sendDefaultPii: false as const,
  };
}
