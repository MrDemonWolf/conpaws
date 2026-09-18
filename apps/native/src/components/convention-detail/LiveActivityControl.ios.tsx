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
import type { LiveActivityControlProps } from "./LiveActivityControl";

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

  if (status !== null && status.availability !== "available") {
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
      setStatus(
        status?.active
          ? await endLiveActivity()
          : await startOrUpdateLiveActivity(),
      );
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
      {status?.active ? (
        <Text variant="caption" className="text-muted-foreground">
          {t("convention.liveActivity.active")}
        </Text>
      ) : null}
    </View>
  );
}
