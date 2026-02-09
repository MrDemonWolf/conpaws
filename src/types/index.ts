export interface Profile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  pronouns: string;
  avatarUrl: string | null;
  verified: boolean;
  createdAt: string;
}

export interface Convention {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  icalUrl: string | null;
}

export interface UserConvention {
  id: string;
  userId: string;
  conventionId: string;
  convention: Convention;
}

export interface ConventionEvent {
  id: string;
  conventionId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  isCustom: boolean;
}

export type PremiumEntitlement = "paw_pass";

export interface PremiumState {
  isActive: boolean;
  entitlements: PremiumEntitlement[];
}
