export interface ManualEventTimes {
  date: Date;
  startTime: Date;
  endTime: Date;
}

function parseDayKey(dayKey: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) throw new Error(`Invalid convention date: ${dayKey}`);

  return [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
}

export function manualEventPickerDate(
  dayKey: string,
  hour = 12,
  minute = 0,
): Date {
  const [year, month, day] = parseDayKey(dayKey);
  return new Date(year, month, day, hour, minute, 0, 0);
}

export function manualEventDayKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export interface ManualEventTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * The calendar fields a picker value stands for, ready to hand to
 * `fromConventionTime`. An overnight end carries its own day, so callers must
 * read the day from the value itself rather than reusing the start's day.
 */
export function manualEventTimeParts(value: Date): ManualEventTimeParts {
  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
    hour: value.getHours(),
    minute: value.getMinutes(),
  };
}

function clampDayKey(dayKey: string, minimumDay: string, maximumDay: string) {
  if (dayKey < minimumDay) return minimumDay;
  if (dayKey > maximumDay) return maximumDay;
  return dayKey;
}

function onDay(dayKey: string, clock: Date): Date {
  return manualEventPickerDate(dayKey, clock.getHours(), clock.getMinutes());
}

function nextDayKey(dayKey: string): string {
  const [year, month, day] = parseDayKey(dayKey);
  // Step through the calendar at midday rather than adding 86_400_000 ms: a
  // device whose zone shifts overnight would otherwise land on the day before.
  return manualEventDayKey(new Date(year, month, day + 1, 12));
}

function nextMinute(value: Date): Date {
  // Built from calendar fields so 23:59 rolls to 00:00 the next day.
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    value.getHours(),
    value.getMinutes() + 1,
    0,
    0,
  );
}

function resolveEndTime(startTime: Date, clock: Date): Date {
  const startDayKey = manualEventDayKey(startTime);
  const sameDayEnd = onDay(startDayKey, clock);

  // Late-night convention programming routinely runs past midnight, so an end
  // earlier in the clock than the start means the next day, not an invalid
  // pick. An end identical to the start carries no such signal, and the end
  // field shows no day, so a silent 24-hour event would be worse than the
  // visible one-minute nudge it replaces.
  if (sameDayEnd.getTime() < startTime.getTime()) {
    return onDay(nextDayKey(startDayKey), clock);
  }
  if (sameDayEnd.getTime() === startTime.getTime()) {
    return nextMinute(startTime);
  }
  return sameDayEnd;
}

export function createManualEventTimes(
  defaultDay: string,
  minimumDay: string,
  maximumDay: string,
): ManualEventTimes {
  const dayKey = clampDayKey(defaultDay, minimumDay, maximumDay);
  return {
    date: manualEventPickerDate(dayKey),
    startTime: manualEventPickerDate(dayKey, 9),
    endTime: manualEventPickerDate(dayKey, 10),
  };
}

export function updateManualEventDate(
  current: ManualEventTimes,
  selectedDate: Date,
  minimumDay: string,
  maximumDay: string,
): ManualEventTimes {
  const dayKey = clampDayKey(
    manualEventDayKey(selectedDate),
    minimumDay,
    maximumDay,
  );
  const startTime = onDay(dayKey, current.startTime);
  return {
    date: manualEventPickerDate(dayKey),
    startTime,
    // Re-derived rather than pinned to the new day so an overnight event keeps
    // its shape when the user moves it to another convention day.
    endTime: resolveEndTime(startTime, current.endTime),
  };
}

export function updateManualEventStart(
  current: ManualEventTimes,
  selectedTime: Date,
  keepEndTimeLater = true,
): ManualEventTimes {
  const dayKey = manualEventDayKey(current.date);
  const startTime = onDay(dayKey, selectedTime);
  if (!keepEndTimeLater) return { ...current, startTime };

  return {
    ...current,
    startTime,
    // The user moved the start, not the end, so nudge the end forward by a
    // minute instead of reading it as overnight; that nudge may itself cross
    // midnight. The start the user picked is never walked backwards.
    endTime:
      current.endTime.getTime() <= startTime.getTime()
        ? nextMinute(startTime)
        : current.endTime,
  };
}

export function updateManualEventEnd(
  current: ManualEventTimes,
  selectedTime: Date,
): ManualEventTimes {
  return {
    ...current,
    endTime: resolveEndTime(current.startTime, selectedTime),
  };
}

export function validatedManualEventEnd(
  startTime: Date,
  endTime: Date,
  includeEndTime: boolean,
): Date | null {
  if (!includeEndTime) return null;
  if (endTime.getTime() <= startTime.getTime()) {
    throw new RangeError("End time must be later than start time");
  }
  return endTime;
}
