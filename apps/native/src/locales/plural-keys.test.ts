import { readFileSync } from "node:fs";
import path from "node:path";
import i18next from "i18next";
import { describe, expect, it } from "vitest";

describe("Slavic plural resources", () => {
  for (const language of ["ru", "pl", "cs", "uk"]) {
    const locale = JSON.parse(
      readFileSync(path.join(__dirname, `${language}.json`), "utf8"),
    );
    it(`${language} has count-aware convention and license forms`, () => {
      for (const key of ["one", "few", "many", "other"]) {
        expect(locale.convention[`longSpan_${key}`]).toEqual(
          expect.any(String),
        );
        expect(locale.settings.about[`licenseDescription_${key}`]).toEqual(
          expect.any(String),
        );
      }
    });

    it(`${language} selects grammatical forms by count`, async () => {
      const instance = i18next.createInstance();
      await instance.init({
        lng: language,
        resources: { [language]: { translation: locale } },
      });
      expect(instance.t("convention.longSpan", { count: 2 })).not.toBe(
        locale.convention.longSpan,
      );
      expect(
        instance.t("settings.about.licenseDescription", { count: 2 }),
      ).not.toBe(locale.settings.about.licenseDescription);
    });
  }
});
