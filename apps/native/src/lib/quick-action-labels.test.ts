import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import { buildQuickActionLabels } from "./quick-action-labels";
import { SUPPORTED_LANGUAGES } from "./supported-locales";

describe("launcher labels", () => {
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

      const labels = buildQuickActionLabels((key) => translator.t(key));
      expect(labels).toEqual({
        schedule: catalog.schedule.title,
        find: catalog.home.find,
        create: catalog.convention.create,
        import: catalog.convention.importSchedule,
      });
      expect(
        Object.values(labels).every((label) => label.trim().length > 0),
      ).toBe(true);
    },
  );
});
