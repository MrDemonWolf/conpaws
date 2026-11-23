import AsyncStorage from "@react-native-async-storage/async-storage";
import { reportError } from "@/lib/error-reporting";
import {
  restoreWatchCommandReceipts,
  watchCommandReceipts,
} from "./watch-command-receipts";

/**
 * Keeps the Watch command receipts across a phone app restart.
 *
 * Without this a tap the phone declined could spin on the Watch for a day:
 * the snapshot listing it is replaced, context and transfer alike, by the
 * next one, and a relaunched app's next one no longer knew the tap. Stored
 * on this device only, never in backups, as the last day's receipts (at most
 * 50, see watch-command-receipts.ts).
 */
export const WATCH_COMMAND_RECEIPTS_KEY = "conpaws.watch.commandReceipts.v1";

let restoring: Promise<number> | null = null;

/**
 * Reads back, once per process, the receipts an earlier process stored.
 * Resolves to how many it added for the first caller and to 0 for every
 * later one, so only the first drain republishes them. A read that fails is
 * reported and not tried again: the taps are still applied, and the next
 * store writes what this process knows.
 */
export async function restoreStoredWatchCommandReceipts(
  nowMs: number,
): Promise<number> {
  if (restoring) {
    await restoring;
    return 0;
  }
  restoring = (async () => {
    try {
      const raw = await AsyncStorage.getItem(WATCH_COMMAND_RECEIPTS_KEY);
      return raw === null
        ? 0
        : restoreWatchCommandReceipts(JSON.parse(raw), nowMs);
    } catch (error) {
      reportError(error, { scope: "watchCommands.restoreReceipts" });
      return 0;
    }
  })();
  return restoring;
}

/** Stores the receipts held now; a failure is reported, never thrown. */
export async function storeWatchCommandReceipts(nowMs: number): Promise<void> {
  const receipts = watchCommandReceipts(nowMs);
  try {
    if (receipts.length === 0) {
      await AsyncStorage.removeItem(WATCH_COMMAND_RECEIPTS_KEY);
    } else {
      await AsyncStorage.setItem(
        WATCH_COMMAND_RECEIPTS_KEY,
        JSON.stringify(receipts),
      );
    }
  } catch (error) {
    reportError(error, { scope: "watchCommands.storeReceipts" });
  }
}

/** Tests only: the next restore reads storage again, as a new process would. */
export function resetStoredWatchCommandReceipts(): void {
  restoring = null;
}
