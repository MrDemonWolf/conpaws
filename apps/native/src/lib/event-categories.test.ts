import { describe, expect, it } from "vitest";
import {
  ageRatingFromCategory,
  ageRatingFromText,
  classifyCategories,
  isRestrictedRating,
  splitCategories,
  strictestRating,
} from "./event-categories";

describe("splitCategories", () => {
  it("trims and drops empties", () => {
    expect(splitCategories(" Gaming , ,13+ Teen ")).toEqual([
      "Gaming",
      "13+ Teen",
    ]);
  });

  it("treats missing values as no categories", () => {
    expect(splitCategories(null)).toEqual([]);
    expect(splitCategories(undefined)).toEqual([]);
    expect(splitCategories("")).toEqual([]);
  });
});

describe("ageRatingFromCategory", () => {
  // Exactly the values a ticketing export's calendar feed emits.
  it("reads the ratings the real feed uses", () => {
    expect(ageRatingFromCategory("General (All Ages)")).toBe("all-ages");
    expect(ageRatingFromCategory("13+ Teen")).toBe("teen");
    expect(ageRatingFromCategory("Mature 17+")).toBe("mature");
    expect(ageRatingFromCategory("Adult 18+")).toBe("adult");
  });

  it("reads the bare 'Age <n>' tags a ticketing export emits", () => {
    // No plus sign and no keyword, so none of the other checks catch these.
    expect(ageRatingFromCategory("Age all")).toBe("all-ages");
    expect(ageRatingFromCategory("Age 13")).toBe("teen");
    expect(ageRatingFromCategory("Age 17")).toBe("mature");
    expect(ageRatingFromCategory("Age 18")).toBe("adult");
    expect(ageRatingFromCategory("AGE ALL")).toBe("all-ages");
  });

  it("leaves a topic that merely starts with 'Age' alone", () => {
    expect(ageRatingFromCategory("Age of Sail")).toBeNull();
    expect(ageRatingFromCategory("Ageless Crafts")).toBeNull();
  });

  it("prefers the number over the word so 'Mature 17+' is not misread", () => {
    expect(ageRatingFromCategory("Mature 18+")).toBe("adult");
    expect(ageRatingFromCategory("Teen 16+")).toBe("teen");
  });

  it("handles spacing and case variations", () => {
    expect(ageRatingFromCategory("  18 +  ")).toBe("adult");
    expect(ageRatingFromCategory("ADULT 18+")).toBe("adult");
    expect(ageRatingFromCategory("all ages")).toBe("all-ages");
  });

  it("recognises wordy audience tags with no number", () => {
    expect(ageRatingFromCategory("Adults Only")).toBe("adult");
    expect(ageRatingFromCategory("NSFW")).toBe("adult");
    expect(ageRatingFromCategory("After Dark")).toBe("adult");
    expect(ageRatingFromCategory("Mature")).toBe("mature");
    expect(ageRatingFromCategory("Family Friendly")).toBe("all-ages");
  });

  it("returns null for topic tags", () => {
    for (const topic of [
      "Gaming",
      "Convention Services",
      "Arts and Crafts",
      "Music and Dance",
      "Meet & Greet",
      "Presentation",
      "Performance",
      "Entertainment",
    ]) {
      expect(ageRatingFromCategory(topic)).toBe(null);
    }
  });

  it("ignores numbers that are not an age gate", () => {
    // A room or track number must not be mistaken for a rating.
    expect(ageRatingFromCategory("Panel Room 3")).toBe(null);
    expect(ageRatingFromCategory("Track 2")).toBe(null);
    expect(ageRatingFromCategory("99+")).toBe(null);
  });

  it("treats a sub-teen number as general audience, not a stricter tier", () => {
    expect(ageRatingFromCategory("6+")).toBe("all-ages");
  });
});

describe("strictestRating", () => {
  it("keeps the more restrictive of two", () => {
    expect(strictestRating("teen", "adult")).toBe("adult");
    expect(strictestRating("adult", "teen")).toBe("adult");
    expect(strictestRating("all-ages", "mature")).toBe("mature");
  });

  it("passes through when one side is unknown", () => {
    expect(strictestRating(null, "teen")).toBe("teen");
    expect(strictestRating("teen", null)).toBe("teen");
    expect(strictestRating(null, null)).toBe(null);
  });
});

describe("classifyCategories", () => {
  it("splits the audience tag from the topic, in either order", () => {
    expect(classifyCategories("13+ Teen,Gaming")).toEqual({
      ageRating: "teen",
      categories: ["Gaming"],
    });
    expect(classifyCategories("Gaming,13+ Teen")).toEqual({
      ageRating: "teen",
      categories: ["Gaming"],
    });
  });

  it("keeps every topic instead of only the first", () => {
    expect(classifyCategories("Gaming,Tabletop,13+ Teen")).toEqual({
      ageRating: "teen",
      categories: ["Gaming", "Tabletop"],
    });
  });

  it("reports null when the feed says nothing about audience", () => {
    expect(classifyCategories("Presentation")).toEqual({
      ageRating: null,
      categories: ["Presentation"],
    });
  });

  it("distinguishes 'no rating given' from 'rated all ages'", () => {
    expect(classifyCategories("Gaming").ageRating).toBe(null);
    expect(classifyCategories("General (All Ages),Gaming").ageRating).toBe(
      "all-ages",
    );
  });

  it("takes the strictest when a feed supplies several", () => {
    expect(classifyCategories("13+ Teen,Adult 18+,Gaming")).toEqual({
      ageRating: "adult",
      categories: ["Gaming"],
    });
  });

  it("handles an empty CATEGORIES property", () => {
    expect(classifyCategories(null)).toEqual({
      ageRating: null,
      categories: [],
    });
  });
});

describe("ageRatingFromText", () => {
  it("catches adult events in feeds that carry no audience tags", () => {
    expect(ageRatingFromText("The Trans Experience: Post-Op (18+)")).toBe(
      "adult",
    );
    expect(ageRatingFromText("Dance After Dark")).toBe("adult");
    expect(ageRatingFromText("NSFW art panel")).toBe("adult");
  });

  it("never guesses the softer tiers from prose", () => {
    expect(ageRatingFromText("Teen hangout")).toBe(null);
    expect(ageRatingFromText("Mature themes discussed")).toBe(null);
    expect(ageRatingFromText("Opening Ceremonies")).toBe(null);
  });
});

describe("isRestrictedRating", () => {
  it("gates on mature and adult only", () => {
    expect(isRestrictedRating("adult")).toBe(true);
    expect(isRestrictedRating("mature")).toBe(true);
    expect(isRestrictedRating("teen")).toBe(false);
    expect(isRestrictedRating("all-ages")).toBe(false);
    expect(isRestrictedRating(null)).toBe(false);
  });
});
