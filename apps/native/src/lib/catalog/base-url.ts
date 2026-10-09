/**
 * Where the public API lives. api.conpaws.com is its own Worker, split from
 * the website; routes sit under /v1 with no /api prefix. The override exists
 * for a local `bun run --filter @conpaws/api dev` server: 127.0.0.1:8790 from
 * the iOS simulator, 10.0.2.2:8790 from the Android emulator.
 */
export function catalogBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_CONPAWS_API_URL?.trim();
  return configured
    ? configured.replace(/\/+$/, "")
    : "https://api.conpaws.com";
}
