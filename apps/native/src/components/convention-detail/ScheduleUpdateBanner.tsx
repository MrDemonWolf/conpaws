import { useTranslation } from "react-i18next";

import { Banner } from "@/components/ui";
import type { ScheduleChangeSummary } from "@/lib/schedule-changes";

/**
 * Says what moved, once, and gets out of the way.
 *
 * It carries no button. The change has already been applied — the panel moved
 * whether or not anyone taps anything — so an action here would be theatre.
 * What the reader needs is a pointer to the rows below, which is where the
 * detail already lives, marked.
 *
 * No counts of anything the user did not save. A feed that shuffled forty
 * panels nobody starred renders nothing at all; the number in here is only
 * ever the number of decisions the reader actually made.
 */
interface ScheduleUpdateBannerProps {
  summary: ScheduleChangeSummary;
  onDismiss: () => void;
}

export function ScheduleUpdateBanner({
  summary,
  onDismiss,
}: ScheduleUpdateBannerProps) {
  const { t } = useTranslation();
  const { savedMoved, savedGone, savedNowDropIn } = summary;
  if (savedMoved === 0 && savedGone === 0 && savedNowDropIn === 0) return null;

  // Gone outranks moved: a panel that is not happening changes the day more
  // than one that shifted rooms, and leading with it puts the sharper fact
  // first for someone scanning while walking. An all-day event that is now a
  // drop-in did not change at all, so it comes last.
  const title =
    savedGone > 0
      ? t(
          savedGone === 1
            ? "convention.scheduleUpdate.goneOne"
            : "convention.scheduleUpdate.goneMany",
          { count: savedGone },
        )
      : savedMoved > 0
        ? t(
            savedMoved === 1
              ? "convention.scheduleUpdate.movedOne"
              : "convention.scheduleUpdate.movedMany",
            { count: savedMoved },
          )
        : t(
            savedNowDropIn === 1
              ? "convention.scheduleUpdate.dropInOne"
              : "convention.scheduleUpdate.dropInMany",
            { count: savedNowDropIn },
          );

  // One/Many rather than an i18next plural, matching movedOne/goneOne above.
  // This read `alsoMoved`, which is not a key in any catalog -- so whenever a
  // refresh both moved and dropped saved panels, the banner body rendered the
  // literal string "convention.scheduleUpdate.alsoMoved".
  const changeBody =
    savedGone > 0 && savedMoved > 0
      ? t(
          savedMoved === 1
            ? "convention.scheduleUpdate.alsoMovedOne"
            : "convention.scheduleUpdate.alsoMovedMany",
          { count: savedMoved },
        )
      : savedGone > 0 || savedMoved > 0
        ? t("convention.scheduleUpdate.body")
        : null;
  // A saved all-day event left the plan until a visit is picked, which is
  // the one thing here the reader has to act on, so it is always said.
  const body = [
    changeBody,
    savedNowDropIn > 0 ? t("convention.scheduleUpdate.dropInBody") : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Banner
      title={title}
      body={body}
      dismissLabel={t("convention.scheduleUpdate.dismiss")}
      onDismiss={onDismiss}
    />
  );
}
