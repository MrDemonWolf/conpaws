import { env } from "@conpaws/env/web";

export type SiteMode = "waitlist" | "live" | "coming-soon" | "maintenance";

export type LaunchConfig = {
  mode: SiteMode;
  appStoreUrl: string;
  googlePlayUrl: string;
  countdownAt?: string;
  maintenanceMessage?: string;
};

/** Public launch controls are baked into each Cloudflare build. */
export const LAUNCH: LaunchConfig = {
  mode: env.NEXT_PUBLIC_SITE_MODE,
  appStoreUrl: env.NEXT_PUBLIC_APP_STORE_URL ?? "",
  googlePlayUrl: env.NEXT_PUBLIC_GOOGLE_PLAY_URL ?? "",
  countdownAt: env.NEXT_PUBLIC_COUNTDOWN_AT,
  maintenanceMessage: env.NEXT_PUBLIC_MAINTENANCE_MESSAGE,
};

export function validateLaunch(config: LaunchConfig = LAUNCH) {
  if (config.mode === "coming-soon" && !config.countdownAt) {
    throw new Error(
      "Coming-soon mode requires NEXT_PUBLIC_COUNTDOWN_AT in ISO 8601 UTC format.",
    );
  }

  for (const [value, host, required] of [
    [config.appStoreUrl, "apps.apple.com", config.mode === "live"],
    [config.googlePlayUrl, "play.google.com", config.mode === "live"],
  ] as const) {
    if (!value && !required) continue;
    const message = `${required ? "Live mode requires" : "Store links must use"} an HTTPS listing on ${host}.`;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(message);
    }
    if (url.protocol !== "https:" || url.hostname !== host) {
      throw new Error(message);
    }
  }
}

/** `?mode=live` lets us preview the finished landing page before launch. */
export function launchForPreview(
  mode: string | string[] | undefined,
): LaunchConfig {
  return mode === "live" ? { ...LAUNCH, mode: "live" } : LAUNCH;
}

validateLaunch();
