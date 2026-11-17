import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "./supported-locales";
import { buildTrackedEventLabels } from "./tracked-event-labels";

describe("tracked event labels", () => {
  it("reads each label from its own key", () => {
    expect(buildTrackedEventLabels((key) => `<${key}>`)).toEqual({
      startsIn: "<tracking.live.startsIn>",
      endsIn: "<tracking.live.endsIn>",
      now: "<tracking.live.now>",
      ended: "<tracking.live.ended>",
      stop: "<tracking.live.stop>",
      channelName: "<tracking.channel.name>",
      channelDescription: "<tracking.channel.description>",
    });
  });

  it.each(SUPPORTED_LANGUAGES)(
    "uses the shipped %s app translations without English fallback",
    async (language) => {
      const catalog = JSON.parse(
        readFileSync(
          resolve(
            dirname(fileURLToPath(import.meta.url)),
            `../locales/${language}.json`,
          ),
          "utf8",
        ),
      );
      const translator = createInstance();
      await translator.init({
        lng: language,
        fallbackLng: false,
        resources: { [language]: { translation: catalog } },
      });

      const labels = buildTrackedEventLabels((key) => translator.t(key));
      expect(labels).toEqual({
        startsIn: catalog.tracking?.live?.startsIn,
        endsIn: catalog.tracking?.live?.endsIn,
        now: catalog.tracking?.live?.now,
        ended: catalog.tracking?.live?.ended,
        stop: catalog.tracking?.live?.stop,
        channelName: catalog.tracking?.channel?.name,
        channelDescription: catalog.tracking?.channel?.description,
      });
      expect(
        Object.values(labels).every((label) => label.trim().length > 0),
      ).toBe(true);
    },
  );
});
