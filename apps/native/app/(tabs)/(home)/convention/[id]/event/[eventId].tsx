import { useQuery } from "@tanstack/react-query";
import { getCalendars } from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import {
  type EventSheetConflict,
  EventSheetContent,
} from "@/components/convention-detail/EventActionSheet";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { useEventScheduleMutations } from "@/hooks/useEventScheduleMutations";
import {
  compareCandidates,
  overlapMinutesBetween,
} from "@/lib/compare-candidates";
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

  const { data: events = [], isSuccess } = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsRepo.getByConventionId(id ?? ""),
    enabled: !!id,
  });
  const event = events.find((item) => item.id === eventId) ?? null;

  const { toggleScheduleMutation, setReminderMutation } =
    useEventScheduleMutations({ conventionId: id });

  const conflicts = useMemo<EventSheetConflict[]>(() => {
    if (!event) return [];
    const set = compareCandidates(events, event.id);
    if (!set) return [];
    return set.conflicts.map((conflict) => ({
      title: conflict.title,
      minutes: overlapMinutesBetween(event, conflict),
    }));
  }, [events, event]);

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
      venue={
        event.room
          ? (event.location ?? convention?.location)
          : convention?.location
      }
      conflicts={conflicts}
      onClose={() => router.back()}
      onToggleSchedule={(item) => toggleScheduleMutation.mutate(item)}
      onSelectReminder={(item, minutes) =>
        setReminderMutation.mutate({ event: item, minutes })
      }
      onCompare={(item) =>
        // Replace rather than stack: a sheet over a sheet is the HIG's one
        // rule for sheets, and the compare sheet already knows how to get back.
        router.replace({
          pathname: "/convention/[id]/compare",
          params: { id: id ?? "", candidateId: item.id },
        })
      }
    />
  );
}
