export function catalogBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_CONPAWS_API_URL?.trim();
  return configured ? configured.replace(/\/+$/, "") : "https://conpaws.com";
}
