export function localizedTimeZoneName(
  timeZone: string,
  locale: string,
): string {
  try {
    return (
      new Intl.DateTimeFormat(locale, {
        timeZone,
        timeZoneName: "longGeneric",
      })
        .formatToParts(new Date(0))
        .find((part) => part.type === "timeZoneName")?.value ?? timeZone
    );
  } catch {
    return timeZone;
  }
}
