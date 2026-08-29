import { useQuery } from "@tanstack/react-query";
import { getCalendars } from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { EventSheetContent } from "@/components/convention-detail/EventActionSheet";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { useEventScheduleMutations } from "@/hooks/useEventScheduleMutations";
import { isValidTimeZone } from "@/lib/convention-time";
import { deviceHour12 } from "@/lib/device-clock";

/**
 * The event sheet, as a pushed formSheet route (registered in the (home)
 * layout). It reads the SAME queries the convention screen holds, so the
 * content is live: a toggle or reminder change invalidates ["events", id] and
 * this sheet re-renders with the new state instead of a stale snapshot.
 */
export default function EventSheetRoute() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const hour12 = deviceHour12();

  const { data: convention } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id,
  });

  const { data: event, isSuccess } = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsRepo.getByConventionId(id ?? ""),
    enabled: !!id,
    select: (events) => events.find((item) => item.id === eventId) ?? null,
  });

  const { toggleScheduleMutation, setReminderMutation } =
    useEventScheduleMutations({ conventionId: id });

  // A deleted event (re-import removed it, say) leaves nothing to show.
  useEffect(() => {
    if (isSuccess && event === null && router.canGoBack()) {
      router.back();
    }
  }, [isSuccess, event]);

  if (!event) return null;

  const storedTimeZone = convention?.timeZone;
  const timeZone = isValidTimeZone(storedTimeZone)
    ? storedTimeZone
    : (getCalendars()[0]?.timeZone ?? "UTC");

  return (
    <EventSheetContent
      event={event}
      timeZone={timeZone}
      hour12={hour12}
      onClose={() => router.back()}
      onToggleSchedule={(item) => toggleScheduleMutation.mutate(item)}
      onSelectReminder={(item, minutes) =>
        setReminderMutation.mutate({ event: item, minutes })
      }
    />
  );
}
