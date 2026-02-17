import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { conventions, conventionEvents } from "@/db/schema";

export type Convention = InferSelectModel<typeof conventions>;
export type NewConvention = InferInsertModel<typeof conventions>;

export type ConventionEvent = InferSelectModel<typeof conventionEvents>;
export type NewConventionEvent = InferInsertModel<typeof conventionEvents>;

export type ConventionStatus = "upcoming" | "active" | "ended";

export type EventType = "imported" | "custom";

export interface ExportData {
  version: number;
  schemaVersion: number;
  exportedAt: string;
  conventions: Convention[];
  events: ConventionEvent[];
}
