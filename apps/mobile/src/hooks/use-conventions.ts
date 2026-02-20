import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as repo from "@/db/repositories/conventions";
import type { Convention, NewConvention } from "@/types";

export function useConventions() {
  return useQuery({
    queryKey: ["conventions"],
    queryFn: repo.getAllConventions,
  });
}

export function useConvention(id: string) {
  return useQuery({
    queryKey: ["conventions", id],
    queryFn: () => repo.getConventionById(id),
    enabled: !!id,
  });
}

export function useCreateConvention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<NewConvention, "id" | "createdAt" | "updatedAt" | "status">,
    ) => repo.createConvention(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conventions"] });
    },
  });
}

export function useUpdateConvention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<Convention, "name" | "startDate" | "endDate" | "icalUrl">>;
    }) => repo.updateConvention(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conventions"] });
    },
  });
}

export function useDeleteConvention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: repo.deleteConvention,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conventions"] });
    },
  });
}
