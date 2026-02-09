export const NAV_THEME = {
  light: {
    background: "hsl(0 0% 100%)",
    border: "hsl(240 5.9% 90%)",
    card: "hsl(0 0% 100%)",
    notification: "hsl(0 84.2% 60.2%)",
    primary: "hsl(210 100% 50%)",
    text: "hsl(240 10% 3.9%)",
    muted: "hsl(240 4.8% 95.9%)",
    mutedForeground: "hsl(240 3.8% 46.1%)",
  },
  dark: {
    background: "hsl(240 10% 3.9%)",
    border: "hsl(240 3.7% 15.9%)",
    card: "hsl(240 10% 3.9%)",
    notification: "hsl(0 72% 51%)",
    primary: "hsl(210 100% 60%)",
    text: "hsl(0 0% 98%)",
    muted: "hsl(240 3.7% 15.9%)",
    mutedForeground: "hsl(240 5% 64.9%)",
  },
} as const;

export const ONBOARDING_STORAGE_KEY = "@conpaws/onboarding-complete";
export const CONVENTIONS_STORAGE_KEY = "@conpaws/conventions";

export const BIO_MAX_LENGTH = 256;
