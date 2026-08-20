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

function clampDayKey(dayKey: string, minimumDay: string, maximumDay: string) {
  if (dayKey < minimumDay) return minimumDay;
  if (dayKey > maximumDay) return maximumDay;
  return dayKey;
}

function onDay(dayKey: string, clock: Date): Date {
  return manualEventPickerDate(dayKey, clock.getHours(), clock.getMinutes());
}

function nextMinuteOnSameDay(startTime: Date): Date {
  return new Date(startTime.getTime() + 60_000);
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
  return {
    date: manualEventPickerDate(dayKey),
    startTime: onDay(dayKey, current.startTime),
    endTime: onDay(dayKey, current.endTime),
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

  const endOfDay = manualEventPickerDate(dayKey, 23, 59);
  if (startTime.getTime() >= endOfDay.getTime()) {
    return {
      ...current,
      startTime: new Date(endOfDay.getTime() - 60_000),
      endTime: endOfDay,
    };
  }

  return {
    ...current,
    startTime,
    endTime:
      current.endTime.getTime() <= startTime.getTime()
        ? nextMinuteOnSameDay(startTime)
        : current.endTime,
  };
}

export function updateManualEventEnd(
  current: ManualEventTimes,
  selectedTime: Date,
): ManualEventTimes {
  const dayKey = manualEventDayKey(current.date);
  const endTime = onDay(dayKey, selectedTime);
  const endOfDay = manualEventPickerDate(dayKey, 23, 59);
  if (current.startTime.getTime() >= endOfDay.getTime()) {
    return {
      ...current,
      startTime: new Date(endOfDay.getTime() - 60_000),
      endTime: endOfDay,
    };
  }

  return {
    ...current,
    endTime:
      endTime.getTime() <= current.startTime.getTime()
        ? nextMinuteOnSameDay(current.startTime)
        : endTime,
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
