export interface ScheduleImportPolicyInput {
  conventionId: string | undefined;
  sourceUrl: string | null;
  selectedEventCount: number;
  sourceEventCount: number;
  cancelledEventCount: number;
}

export function canApplyScheduleImport({
  conventionId,
  sourceUrl,
  selectedEventCount,
  sourceEventCount,
  cancelledEventCount,
}: ScheduleImportPolicyInput): boolean {
  if (selectedEventCount > 0) return true;

  const isExistingConvention = !!conventionId && conventionId !== "new";
  if (!isExistingConvention) return false;
  if (cancelledEventCount > 0) return true;

  return sourceUrl !== null && sourceEventCount === 0;
}
