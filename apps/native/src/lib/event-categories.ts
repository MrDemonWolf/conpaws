/**
 * Convention feeds put audience ratings and topic tags in the same ICS
 * `CATEGORIES` property. IndyFurCon's calendar, for example, emits
 * `CATEGORIES:13+ Teen,Gaming` — one audience tag and one topic, unordered.
 *
 * Splitting them matters for display (the rating is a warning, the topic is a
 * filter) and for correctness: keeping only the first value, as the parser used
 * to, silently discarded whichever one happened to come second.
 */

/** Ordered least to most restrictive; the order is load-bearing. */
export const AGE_RATINGS = ["all-ages", "teen", "mature", "adult"] as const;

export type AgeRating = (typeof AGE_RATINGS)[number];

export interface ClassifiedCategories {
  /** `null` when the feed said nothing about audience. Not the same as all-ages. */
  ageRating: AgeRating | null;
  /** Topic tags, in feed order, with audience tags removed. */
  categories: string[];
}

/** Splits an unescaped CATEGORIES value into trimmed, non-empty parts. */
export function splitCategories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function ratingFromAgeNumber(age: number): AgeRating | null {
  if (age >= 18) return "adult";
  if (age >= 17) return "mature";
  if (age >= 13) return "teen";
  // 12 and under is not a restriction any convention enforces; treat it as a
  // general-audience label rather than inventing a stricter tier.
  return "all-ages";
}

/**
 * Reads an audience rating out of a single tag, or returns `null` if the tag is
 * a topic.
 *
 * Numbers are checked before keywords so "Mature 17+" resolves on the 17 rather
 * than on the softer word, and so a con inventing "16+ Teen" still lands in the
 * teen tier instead of falling through to topic.
 */
export function ageRatingFromCategory(category: string): AgeRating | null {
  const value = category.trim().toLowerCase();
  if (!value) return null;

  const ageMatch = value.match(/\b(\d{1,2})\s*\+/);
  if (ageMatch) {
    const age = Number(ageMatch[1]);
    if (Number.isFinite(age) && age > 0 && age <= 21) {
      return ratingFromAgeNumber(age);
    }
  }

  if (/\ball ages\b|\bgeneral\b|\bg[- ]rated\b|\bfamily\b/.test(value)) {
    return "all-ages";
  }
  if (/\badults? only\b|\badult\b|\bnsfw\b|\bafter dark\b/.test(value)) {
    return "adult";
  }
  if (/\bmature\b/.test(value)) return "mature";
  if (/\bteen\b/.test(value)) return "teen";

  return null;
}

/** Returns the more restrictive of two ratings. */
export function strictestRating(
  a: AgeRating | null,
  b: AgeRating | null,
): AgeRating | null {
  if (a === null) return b;
  if (b === null) return a;
  return AGE_RATINGS.indexOf(a) >= AGE_RATINGS.indexOf(b) ? a : b;
}

/**
 * Splits a feed's category tags into an audience rating and the topic tags.
 *
 * When a feed supplies several audience tags the strictest wins, because
 * showing the softer one would understate the restriction.
 */
export function classifyCategories(
  raw: string | null | undefined,
): ClassifiedCategories {
  const parts = splitCategories(raw);
  const categories: string[] = [];
  let ageRating: AgeRating | null = null;

  for (const part of parts) {
    const rating = ageRatingFromCategory(part);
    if (rating) {
      ageRating = strictestRating(ageRating, rating);
    } else {
      categories.push(part);
    }
  }

  return { ageRating, categories };
}

/**
 * Fallback for feeds with no audience tags at all — Sched exports carry topics
 * only, so without this an 18+ panel would show no warning whatsoever.
 *
 * Deliberately conservative: it only claims "adult", never the softer tiers,
 * because prose is far too weak a signal to draw a 13-versus-17 line from.
 */
export function ageRatingFromText(text: string): AgeRating | null {
  return /18\+|nsfw|\badults? only\b|after dark/i.test(text) ? "adult" : null;
}

/** True when the rating implies an age gate the attendee must be warned about. */
export function isRestrictedRating(rating: AgeRating | null): boolean {
  return rating === "mature" || rating === "adult";
}
