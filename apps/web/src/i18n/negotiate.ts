/**
 * Match a browser's language preferences against the locales this site has.
 *
 * This function is deliberately self-contained — no imports, no references to
 * anything outside its own body. It is serialised with `Function.prototype
 * .toString()` into the blocking `<head>` script that runs before first paint
 * (see `components/locale-detect.tsx`), so it has to survive being lifted out
 * of the module system entirely. Anything it closes over would arrive at the
 * browser as a ReferenceError.
 *
 * That constraint is also why the alias table lives inside the function rather
 * than beside it, and why the tests import the same function the script ships:
 * one implementation, tested once.
 */
export function pickLocale(
  preferred: readonly string[],
  available: readonly string[],
): string | null {
  // Cases where stripping subtags left-to-right lands on the wrong answer.
  //
  // `zh` is the one that actually matters: this site lists Traditional before
  // Simplified, so a plain `zh` would fall to `zh-TW` on list order alone,
  // when the overwhelmingly likelier intent is Simplified. Script subtags
  // (`zh-Hant`, `zh-Hans`) and the territories that imply them are spelled out
  // because browsers really do send `zh-Hant-TW` and `zh-HK`.
  //
  // Norwegian is the other: browsers send `no` or `nn`, neither of which is a
  // prefix of `nb`, so nothing else here would ever match them.
  const ALIAS: Record<string, string> = {
    zh: "zh-CN",
    "zh-hans": "zh-CN",
    "zh-sg": "zh-CN",
    "zh-my": "zh-CN",
    "zh-hant": "zh-TW",
    "zh-hk": "zh-TW",
    "zh-mo": "zh-TW",
    es: "es-419",
    pt: "pt-BR",
    no: "nb",
    nn: "nb",
  };

  const have = new Map<string, string>();
  for (const code of available) have.set(code.toLowerCase(), code);

  for (const raw of preferred) {
    if (typeof raw !== "string" || raw === "") continue;
    const parts = raw.toLowerCase().split("-");

    // Longest prefix first: `zh-hant-tw` is tried as `zh-hant-tw`, then
    // `zh-hant`, then `zh`, so the most specific thing the browser asked for
    // wins before anything more general is considered.
    for (let n = parts.length; n > 0; n--) {
      const tag = parts.slice(0, n).join("-");

      const exact = have.get(tag);
      if (exact) return exact;

      const aliased = ALIAS[tag];
      if (aliased && have.has(aliased.toLowerCase())) {
        return have.get(aliased.toLowerCase()) as string;
      }
    }

    // Nothing matched by prefix. Fall back to any locale sharing the base
    // language — this is what makes a future `de-DE`-only list still answer a
    // request for plain `de`, and it takes list order, which is display order.
    const base = parts[0];
    for (const code of available) {
      if (code.toLowerCase().split("-")[0] === base) return code;
    }
  }

  return null;
}
