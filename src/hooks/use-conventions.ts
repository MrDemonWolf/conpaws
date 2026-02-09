import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONVENTIONS_STORAGE_KEY } from "@/lib/constants";
import type { Convention } from "@/types";

export function useConventions() {
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConventions();
  }, []);

  async function loadConventions() {
    const stored = await AsyncStorage.getItem(CONVENTIONS_STORAGE_KEY);
    if (stored) {
      setConventions(JSON.parse(stored));
    }
    setIsLoading(false);
  }

  const addConvention = useCallback(
    async (convention: Omit<Convention, "id">) => {
      const newConvention: Convention = {
        ...convention,
        id: Date.now().toString(),
      };
      const updated = [...conventions, newConvention];
      await AsyncStorage.setItem(
        CONVENTIONS_STORAGE_KEY,
        JSON.stringify(updated),
      );
      setConventions(updated);
      return newConvention;
    },
    [conventions],
  );

  const removeConvention = useCallback(
    async (id: string) => {
      const updated = conventions.filter((c) => c.id !== id);
      await AsyncStorage.setItem(
        CONVENTIONS_STORAGE_KEY,
        JSON.stringify(updated),
      );
      setConventions(updated);
    },
    [conventions],
  );

  return { conventions, isLoading, addConvention, removeConvention };
}

export function getConventionStatus(convention: Convention) {
  const now = new Date();
  const start = new Date(convention.startDate);
  const end = new Date(convention.endDate);

  if (now < start) {
    const days = Math.ceil(
      (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { status: "upcoming" as const, label: `${days} day${days !== 1 ? "s" : ""} until` };
  }

  if (now >= start && now <= end) {
    const day =
      Math.floor(
        (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;
    return { status: "active" as const, label: `Day ${day}` };
  }

  const days = Math.ceil(
    (now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24),
  );
  return { status: "ended" as const, label: `Ended ${days} day${days !== 1 ? "s" : ""} ago` };
}
