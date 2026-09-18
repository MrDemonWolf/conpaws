import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";
import { Button, Text } from "@/components/ui";
import {
  endLiveActivity,
  getLiveActivityStatus,
  type LiveActivityStatus,
  startOrUpdateLiveActivity,
} from "@/services/live-activity";
import { requestNotificationPermission } from "@/services/notifications";
import type { LiveActivityControlProps } from "./LiveActivityControl";

/**
 * Android's equivalent is an ordinary low-priority ongoing notification.
 * The shared service name stays platform-neutral even though iOS presents it
 * as a Live Activity.
 */
export function LiveActivityControl({
  hasTrackablePlan,
  revision,
}: LiveActivityControlProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LiveActivityStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getLiveActivityStatus()
      .then((current) =>
        current.active && revision !== ""
          ? startOrUpdateLiveActivity()
          : current,
      )
      .then((current) => {
        if (!cancelled) setStatus(current);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ availability: "unsupported", active: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  if (!hasTrackablePlan && !status?.active) return null;

  if (
    status !== null &&
    status.availability === "unsupported" &&
    !status.active
  ) {
    return (
      <View className="mx-4 my-2 rounded-xl border border-border bg-card px-4 py-3">
        <Text variant="caption" className="text-muted-foreground">
          {t("convention.liveActivity.unavailable")}
        </Text>
      </View>
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (status?.active) {
        // A user stop removes the notification immediately. The brief
        // finished state is reserved for a naturally completed tracked plan.
        setStatus(await endLiveActivity(false));
        return;
      }
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        setStatus({ availability: "disabled", active: false });
        return;
      }
      setStatus(await startOrUpdateLiveActivity());
    } catch {
      Alert.alert(
        t("convention.liveActivity.errorTitle"),
        t("convention.liveActivity.errorMessage"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="mx-4 my-2 gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <Button
        onPress={() => void toggle()}
        variant={status?.active ? "outline" : "default"}
        loading={status === null || busy}
        accessibilityLabel={t(
          status?.active
            ? "convention.liveActivity.stop"
            : "convention.liveActivity.track",
        )}
      >
        {t(
          status?.active
            ? "convention.liveActivity.stop"
            : "convention.liveActivity.track",
        )}
      </Button>
      {status?.active || status?.availability === "disabled" ? (
        <Text variant="caption" className="text-muted-foreground">
          {status.active && status.availability === "available"
            ? t("convention.liveActivity.active")
            : t("convention.liveActivity.unavailable")}
        </Text>
      ) : null}
    </View>
  );
}
