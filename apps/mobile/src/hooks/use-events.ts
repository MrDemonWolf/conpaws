import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as repo from "@/db/repositories/events";
import type { ConventionEvent, NewConventionEvent } from "@/types";

export function useEvents(conventionId: string) {
  return useQuery({
    queryKey: ["events", conventionId],
    queryFn: () => repo.getEventsByConventionId(conventionId),
    enabled: !!conventionId,
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: () => repo.getEventById(id),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<NewConventionEvent, "id" | "createdAt" | "updatedAt">,
    ) => repo.createEvent(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["events", variables.conventionId],
      });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      conventionId: string;
      data: Partial<
        Pick<
          ConventionEvent,
          | "title"
          | "description"
          | "startTime"
          | "endTime"
          | "location"
          | "room"
          | "category"
          | "contentWarning"
          | "isAgeRestricted"
        >
      >;
    }) => repo.updateEvent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["events", variables.conventionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["event", variables.id],
      });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; conventionId: string }) =>
      repo.deleteEvent(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["events", variables.conventionId],
      });
    },
  });
}

export function useToggleSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      isInSchedule,
    }: {
      id: string;
      conventionId: string;
      isInSchedule: boolean;
    }) => repo.toggleSchedule(id, isInSchedule),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["events", variables.conventionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["event", variables.id],
      });
    },
  });
}

export function useSetReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      reminderMinutes,
    }: {
      id: string;
      conventionId: string;
      reminderMinutes: number | null;
    }) => repo.setReminder(id, reminderMinutes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["event", variables.id],
      });
    },
  });
}
