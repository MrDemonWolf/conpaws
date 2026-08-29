import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { db } from "@/db";
import {
  type Convention,
  type ConventionEvent,
  conventionEvents,
  conventions,
} from "@/db/schema";
import { isValidTimeZone } from "@/lib/convention-time";
import { reportError } from "@/lib/error-reporting";

/**
 * Largest backup this will read into memory.
 *
 * A restore of a heavy schedule year is a few megabytes of JSON. The ICS path
 * already draws its line at 8MB (`MAX_ICS_BYTES`) and the same number is
 * generous here, while still keeping `JSON.parse` off a file big enough to get
 * the app killed by the OS before it can say what went wrong.
 */
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

/**
 * Largest row count a backup may carry. Every insert runs synchronously inside
 * one transaction, so this is the bound on how long the JS thread is held.
 */
export const MAX_BACKUP_ROWS = 50_000;

/** Longest accepted value for an id, name, title, room or URL. */
const MAX_FIELD_CHARS = 1_000;

/** Longest accepted event description. */
const MAX_DESCRIPTION_CHARS = 50_000;

// Dates outside this window are not a convention schedule, they are a corrupt
// or hand-edited file. The narrow window also keeps `new Date(...)` away from
// the values date-fns and Intl refuse to format.
const MIN_INSTANT_MS = Date.UTC(1900, 0, 1);
const MAX_INSTANT_MS = Date.UTC(2200, 0, 1);

const CONVENTION_STATUSES = ["upcoming", "active", "ended"] as const;
const AGE_RATINGS = ["all-ages", "teen", "mature", "adult"] as const;
const FEED_STATUSES = ["cancelled", "removed"] as const;

/**
 * Why an import produced nothing. `cancelled` is not a failure: the user
 * closed the file picker and the UI should say nothing at all.
 */
export type ImportErrorCode =
  | "cancelled"
  | "file-too-large"
  | "unreadable"
  | "invalid-json"
  | "not-an-object"
  | "unsupported-version"
  | "not-conpaws"
  | "missing-data"
  | "malformed-data"
  | "too-many-rows"
  | "write-failed";

export interface ImportErrorDetail {
  /** Size of the picked file, for `file-too-large`. */
  bytes?: number;
  /** The ceiling that was passed, for `file-too-large` and `too-many-rows`. */
  limit?: number;
  /** Combined row count in the file, for `too-many-rows`. */
  rows?: number;
}

export interface ImportFailure {
  ok: false;
  code: ImportErrorCode;
  detail?: ImportErrorDetail;
}

/** Why a single row inside an otherwise valid backup was not written. */
export type ImportSkipReason =
  | "duplicate"
  | "orphan"
  | "malformed"
  | "invalid-date";

export interface ImportSuccess {
  ok: true;
  conventionsAdded: number;
  eventsAdded: number;
  /** Rows the file carried that were not written. Equals the sum of `reasons`. */
  skipped: number;
  /** Skip count per reason. Every key is always present, zero when unused. */
  reasons: Record<ImportSkipReason, number>;
}

export type ImportOutcome = ImportSuccess | ImportFailure;

/** A backup that passed envelope validation. Rows are still untrusted. */
export interface BackupEnvelope {
  conventions: unknown[];
  events: unknown[];
}

export interface BackupPreview {
  ok: true;
  envelope: BackupEnvelope;
  conventionCount: number;
  eventCount: number;
}

export type BackupPickOutcome = BackupPreview | ImportFailure;

function fail(
  code: ImportErrorCode,
  detail?: ImportErrorDetail,
): ImportFailure {
  return detail ? { ok: false, code, detail } : { ok: false, code };
}

function emptyReasons(): Record<ImportSkipReason, number> {
  return { duplicate: 0, orphan: 0, malformed: 0, "invalid-date": 0 };
}

/**
 * Checks the envelope only. Every row inside is still arbitrary JSON at this
 * point; `planDataImport` is what decides whether any of it may be written.
 */
export function validateImportFile(payload: unknown): BackupPickOutcome {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return fail("not-an-object");
  }

  const obj = payload as Record<string, unknown>;

  if (obj.version !== 1) return fail("unsupported-version");
  if (obj.app !== "ConPaws") return fail("not-conpaws");
  if (typeof obj.data !== "object" || obj.data === null) {
    return fail("missing-data");
  }

  const data = obj.data as Record<string, unknown>;
  if (!Array.isArray(data.conventions) || !Array.isArray(data.events)) {
    return fail("malformed-data");
  }

  const rows = data.conventions.length + data.events.length;
  if (rows > MAX_BACKUP_ROWS) {
    return fail("too-many-rows", { rows, limit: MAX_BACKUP_ROWS });
  }

  return {
    ok: true,
    envelope: { conventions: data.conventions, events: data.events },
    conventionCount: data.conventions.length,
    eventCount: data.events.length,
  };
}

/**
 * `JSON.parse` produces own `__proto__`, `constructor` and `prototype` keys
 * verbatim, so a row is read field by field through this rather than spread.
 * Nothing the file names outside the column lists below can reach an insert.
 */
function ownString(row: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(row, key) ? row[key] : undefined;
}

function requiredString(
  row: Record<string, unknown>,
  key: string,
  maxChars = MAX_FIELD_CHARS,
): string | null {
  const value = ownString(row, key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxChars) return null;
  return trimmed;
}

/**
 * Returns `undefined` for a value that is present but the wrong type, so a
 * caller can tell "the file said null" from "the file said something absurd".
 */
function optionalString(
  row: Record<string, unknown>,
  key: string,
  maxChars = MAX_FIELD_CHARS,
): string | null | undefined {
  const value = ownString(row, key);
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  if (value.length > maxChars) return undefined;
  return value;
}

function optionalBoolean(row: Record<string, unknown>, key: string): boolean {
  return ownString(row, key) === true;
}

function isUsableInstant(value: string): boolean {
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms >= MIN_INSTANT_MS && ms < MAX_INSTANT_MS;
}

function timestampOrNow(
  row: Record<string, unknown>,
  key: string,
  now: string,
): string {
  const value = ownString(row, key);
  return typeof value === "string" && isUsableInstant(value) ? value : now;
}

function oneOf<T extends string>(
  row: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = ownString(row, key);
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

type RowResult<T> = { row: T } | { reason: ImportSkipReason };

export function validateConventionRow(
  candidate: unknown,
  now: string,
): RowResult<Convention> {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return { reason: "malformed" };
  }
  const row = candidate as Record<string, unknown>;

  const id = requiredString(row, "id");
  const name = requiredString(row, "name");
  if (!id || !name) return { reason: "malformed" };

  const location = optionalString(row, "location");
  const icalUrl = optionalString(row, "icalUrl");
  if (location === undefined || icalUrl === undefined) {
    return { reason: "malformed" };
  }

  const startDate = requiredString(row, "startDate");
  const endDate = requiredString(row, "endDate");
  if (!startDate || !endDate) return { reason: "malformed" };
  if (!isUsableInstant(startDate) || !isUsableInstant(endDate)) {
    return { reason: "invalid-date" };
  }

  const archivedAt = optionalString(row, "archivedAt");
  if (archivedAt === undefined) return { reason: "malformed" };
  if (archivedAt !== null && !isUsableInstant(archivedAt)) {
    return { reason: "invalid-date" };
  }

  const timeZone = optionalString(row, "timeZone");

  return {
    row: {
      id,
      name,
      startDate,
      endDate,
      // The drizzle `enum` is a compile-time narrowing with no CHECK behind it,
      // so an out-of-set status has to be caught here or it persists.
      status: oneOf(row, "status", CONVENTION_STATUSES) ?? "upcoming",
      timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : null,
      location,
      archivedAt,
      icalUrl,
      createdAt: timestampOrNow(row, "createdAt", now),
      updatedAt: timestampOrNow(row, "updatedAt", now),
    },
  };
}

export function validateEventRow(
  candidate: unknown,
  now: string,
): RowResult<ConventionEvent> {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return { reason: "malformed" };
  }
  const row = candidate as Record<string, unknown>;

  const id = requiredString(row, "id");
  const conventionId = requiredString(row, "conventionId");
  const title = requiredString(row, "title");
  if (!id || !conventionId || !title) return { reason: "malformed" };

  const description = optionalString(row, "description", MAX_DESCRIPTION_CHARS);
  const location = optionalString(row, "location");
  const room = optionalString(row, "room");
  const category = optionalString(row, "category");
  const type = optionalString(row, "type");
  const sourceUid = optionalString(row, "sourceUid");
  const sourceUrl = optionalString(row, "sourceUrl");
  if (
    description === undefined ||
    location === undefined ||
    room === undefined ||
    category === undefined ||
    type === undefined ||
    sourceUid === undefined ||
    sourceUrl === undefined
  ) {
    return { reason: "malformed" };
  }

  const startTime = requiredString(row, "startTime");
  if (!startTime) return { reason: "malformed" };
  // The convention screen formats both of these with date-fns and Intl, which
  // throw on an unparseable value. A row that gets through here breaks that
  // screen on every launch and there is no in-app way to delete it.
  if (!isUsableInstant(startTime)) return { reason: "invalid-date" };

  const endTime = optionalString(row, "endTime");
  if (endTime === undefined) return { reason: "malformed" };
  if (endTime !== null && !isUsableInstant(endTime)) {
    return { reason: "invalid-date" };
  }

  return {
    row: {
      id,
      conventionId,
      title,
      description,
      startTime,
      endTime,
      location,
      room,
      category,
      type,
      isInSchedule: optionalBoolean(row, "isInSchedule"),
      // A restored reminder must be explicitly re-enabled so the OS schedule
      // matches SQLite.
      reminderMinutes: null,
      sourceUid,
      sourceUrl,
      isAgeRestricted: optionalBoolean(row, "isAgeRestricted"),
      ageRating: oneOf(row, "ageRating", AGE_RATINGS),
      // Restored as-is. A backup taken while an event was marked should come
      // back marked; the next successful import of that feed clears it, which
      // is the same way the mark clears anywhere else.
      feedStatus: oneOf(row, "feedStatus", FEED_STATUSES),
      contentWarning: optionalBoolean(row, "contentWarning"),
      createdAt: timestampOrNow(row, "createdAt", now),
      updatedAt: timestampOrNow(row, "updatedAt", now),
    },
  };
}

export interface DataImportPlan {
  conventions: Convention[];
  events: ConventionEvent[];
  result: ImportSuccess;
}

export function planDataImport(
  envelope: BackupEnvelope,
  existingConventionIds: ReadonlySet<string>,
  existingEventIds: ReadonlySet<string>,
  now: string = new Date().toISOString(),
): DataImportPlan {
  const knownConventionIds = new Set(existingConventionIds);
  const knownEventIds = new Set(existingEventIds);
  const conventionsToInsert: Convention[] = [];
  const eventsToInsert: ConventionEvent[] = [];
  const reasons = emptyReasons();

  for (const candidate of envelope.conventions) {
    const validated = validateConventionRow(candidate, now);
    if ("reason" in validated) {
      reasons[validated.reason]++;
      continue;
    }
    if (knownConventionIds.has(validated.row.id)) {
      reasons.duplicate++;
      continue;
    }
    knownConventionIds.add(validated.row.id);
    conventionsToInsert.push(validated.row);
  }

  for (const candidate of envelope.events) {
    const validated = validateEventRow(candidate, now);
    if ("reason" in validated) {
      reasons[validated.reason]++;
      continue;
    }
    if (knownEventIds.has(validated.row.id)) {
      reasons.duplicate++;
      continue;
    }
    if (!knownConventionIds.has(validated.row.conventionId)) {
      reasons.orphan++;
      continue;
    }
    knownEventIds.add(validated.row.id);
    eventsToInsert.push(validated.row);
  }

  const skipped = Object.values(reasons).reduce((sum, n) => sum + n, 0);

  return {
    conventions: conventionsToInsert,
    events: eventsToInsert,
    result: {
      ok: true,
      conventionsAdded: conventionsToInsert.length,
      eventsAdded: eventsToInsert.length,
      skipped,
      reasons,
    },
  };
}

/**
 * Splits rows so no single statement approaches SQLite's bound-parameter
 * ceiling. 900 is well under the lowest limit any expo-sqlite build ships with.
 */
export function chunkRows<T>(rows: readonly T[], columns: number): T[][] {
  const size = Math.max(1, Math.floor(900 / Math.max(1, columns)));
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

const CONVENTION_COLUMNS = 11;
const EVENT_COLUMNS = 19;

export async function importData(
  envelope: BackupEnvelope,
): Promise<ImportOutcome> {
  try {
    return db.transaction((tx) => {
      const existingConventionIds = new Set(
        tx
          .select({ id: conventions.id })
          .from(conventions)
          .all()
          .map((row) => row.id),
      );
      const existingEventIds = new Set(
        tx
          .select({ id: conventionEvents.id })
          .from(conventionEvents)
          .all()
          .map((row) => row.id),
      );
      const plan = planDataImport(
        envelope,
        existingConventionIds,
        existingEventIds,
      );

      for (const batch of chunkRows(plan.conventions, CONVENTION_COLUMNS)) {
        tx.insert(conventions).values(batch).run();
      }
      for (const batch of chunkRows(plan.events, EVENT_COLUMNS)) {
        tx.insert(conventionEvents).values(batch).run();
      }

      return plan.result;
    });
  } catch (error) {
    reportError(error, { scope: "data-import.write" });
    return fail("write-failed");
  }
}

/**
 * Opens the picker and returns a validated envelope plus the counts a
 * confirmation prompt needs. Nothing is written and nothing is displayed: the
 * caller owns every message, so this never composes user-facing text.
 */
export async function pickBackupFile(): Promise<BackupPickOutcome> {
  let picked: DocumentPicker.DocumentPickerResult;
  try {
    picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "*/*"],
      copyToCacheDirectory: true,
    });
  } catch (error) {
    reportError(error, { scope: "data-import.pick" });
    return fail("unreadable");
  }

  if (picked.canceled) return fail("cancelled");

  const file = picked.assets[0];
  if (!file) return fail("unreadable");

  // The picker accepts any file on the device, so the size is checked before
  // the contents are pulled into a string and parsed again into objects.
  if (typeof file.size === "number" && file.size > MAX_BACKUP_BYTES) {
    return fail("file-too-large", {
      bytes: file.size,
      limit: MAX_BACKUP_BYTES,
    });
  }

  let content: string;
  try {
    content = await new File(file.uri).text();
  } catch (error) {
    reportError(error, { scope: "data-import.read" });
    return fail("unreadable");
  }

  if (content.length > MAX_BACKUP_BYTES) {
    return fail("file-too-large", {
      bytes: content.length,
      limit: MAX_BACKUP_BYTES,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return fail("invalid-json");
  }

  return validateImportFile(parsed);
}

/**
 * Asks the user to confirm a restore. The caller owns the prompt, so it also
 * owns settling this promise: on Android an Alert is dismissible without any
 * button, and a confirm that never settles pins the mutation in `isPending`
 * and disables the whole Data section until the app restarts.
 */
export type ImportConfirm = (preview: {
  conventionCount: number;
  eventCount: number;
}) => Promise<boolean>;

export interface UseImportDataOptions {
  confirm: ImportConfirm;
  /**
   * Called exactly once per run with the structured result, including
   * `{ ok: false, code: "cancelled" }` when the user backed out.
   */
  onOutcome: (outcome: ImportOutcome) => void;
}

export function useImportData({ confirm, onOutcome }: UseImportDataOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation<ImportOutcome>({
    mutationFn: async () => {
      const picked = await pickBackupFile();
      if (!picked.ok) return picked;

      const confirmed = await confirm({
        conventionCount: picked.conventionCount,
        eventCount: picked.eventCount,
      });
      if (!confirmed) return fail("cancelled");

      return importData(picked.envelope);
    },
    onSuccess: (outcome) => {
      if (outcome.ok) {
        queryClient.invalidateQueries({ queryKey: ["conventions"] });
      }
      onOutcome(outcome);
    },
    onError: (error) => {
      reportError(error, { scope: "data-import.mutation" });
      onOutcome(fail("write-failed"));
    },
  });

  return {
    importData: mutation.mutate,
    isLoading: mutation.isPending,
  };
}
