/**
 * Which swipe edge does what on an event row.
 *
 * One direction adds, the other removes, and the side that does not apply is
 * simply absent — so an unstarred row cannot be "removed" and a starred row
 * cannot be "added". Encoding it here keeps the row component free of the
 * decision and gives the rule a test.
 */
export function eventSwipeSides(
  isInSchedule: boolean,
  canAdd = true,
): {
  leading: "add" | null;
  trailing: "remove" | null;
} {
  if (isInSchedule) return { leading: null, trailing: "remove" };
  return canAdd
    ? { leading: "add", trailing: null }
    : { leading: null, trailing: null };
}
