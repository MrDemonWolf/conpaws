export const APP_NAME = "ConPaws";
export const APP_VERSION = "0.1.0";
export const APP_TAGLINE = "Your convention companion";

export const LEGAL_URLS = {
  privacy: "https://conpaws.app/privacy",
  terms: "https://conpaws.app/terms",
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  "CONVENTION SERVICES": "#6D28D9",
  "FURSUITING": "#2563eb",
  "ARTS & CRAFTS": "#db2777",
  "MEET & GREET": "#16a34a",
  "MUSIC & DANCE": "#ea580c",
  "GAMING": "#7c3aed",
  "PERFORMANCE": "#0891b2",
  "WRITING": "#65a30d",
  "ENTERTAINMENT": "#d97706",
  "SOCIAL": "#0d9488",
  "PRESENTATION": "#4f46e5",
  DEFAULT: "#78716c",
} as const;

export const REMINDER_OPTIONS = [
  { label: "None", value: null },
  { label: "5 minutes before", value: 5 },
  { label: "15 minutes before", value: 15 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
] as const;
