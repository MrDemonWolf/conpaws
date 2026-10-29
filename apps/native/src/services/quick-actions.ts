import { requireOptionalNativeModule } from "expo";
import i18n from "@/lib/i18n";
import {
  buildQuickActionLabels,
  type QuickActionLabels,
} from "@/lib/quick-action-labels";

interface QuickActionsModule {
  consumePendingQuickAction(): string | null;
  setQuickActionLabels?(labels: QuickActionLabels): Promise<boolean>;
  addListener?(name: "onQuickAction", listener: () => void): { remove(): void };
}

const quickActionsModule = requireOptionalNativeModule<QuickActionsModule>(
  "ConPawsQuickActions",
);
// Older Apple binaries keep their consume-only bridge until rebuilt.
const legacyModule = quickActionsModule
  ? null
  : requireOptionalNativeModule<QuickActionsModule>("ConPawsWidgets");

export async function updateQuickActionLabels(): Promise<boolean> {
  if (!quickActionsModule?.setQuickActionLabels || !i18n.isInitialized) {
    return false;
  }
  return quickActionsModule.setQuickActionLabels(
    buildQuickActionLabels((key) => i18n.t(key)),
  );
}

export function subscribeToQuickActions(listener: () => void): () => void {
  const subscription = quickActionsModule?.addListener?.(
    "onQuickAction",
    listener,
  );
  return () => subscription?.remove();
}

export function consumePendingQuickAction(canNavigate: boolean): string | null {
  if (!canNavigate) return null;
  return (
    (quickActionsModule ?? legacyModule)?.consumePendingQuickAction() ?? null
  );
}
