import type { BadgeVariant } from "@/components/ui/Badge";
import type { AgeRating } from "./event-categories";

/** Only ratings that restrict who may attend get a pill. */
const AGE_BADGES: Partial<
  Record<AgeRating, { variant: BadgeVariant; key: string }>
> = {
  teen: { variant: "age-teen", key: "convention.ageRatings.teen" },
  mature: { variant: "age-mature", key: "convention.ageRatings.mature" },
  adult: { variant: "age-adult", key: "convention.ageRatings.adult" },
};

export function ageBadgeFor(ageRating?: AgeRating | null) {
  return ageRating ? AGE_BADGES[ageRating] : undefined;
}
