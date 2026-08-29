import { DEFAULT_LOCALE, type Locale } from "./config";
import cs from "./messages/cs.json";
import da from "./messages/da.json";
import de from "./messages/de.json";
import en from "./messages/en.json";
import es419 from "./messages/es-419.json";
import esES from "./messages/es-ES.json";
import fi from "./messages/fi.json";
import fr from "./messages/fr.json";
import hu from "./messages/hu.json";
import it from "./messages/it.json";
import ja from "./messages/ja.json";
import ko from "./messages/ko.json";
import ms from "./messages/ms.json";
import nb from "./messages/nb.json";
import nl from "./messages/nl.json";
import pl from "./messages/pl.json";
import ptBR from "./messages/pt-BR.json";
import ptPT from "./messages/pt-PT.json";
import ru from "./messages/ru.json";
import sv from "./messages/sv.json";
import uk from "./messages/uk.json";
import zhCN from "./messages/zh-CN.json";
import zhTW from "./messages/zh-TW.json";

/**
 * The English catalog is the source of truth for both shape and content.
 * Every other locale is a partial overlay on top of it.
 */
export type Messages = typeof en;

/**
 * Catalogs are imported eagerly rather than with `import()`.
 *
 * The whole set is a few hundred kilobytes of JSON and the pages are
 * statically rendered, so there is nothing to gain from splitting it — and
 * dynamic import of local JSON is one of the places the OpenNext Cloudflare
 * adapter has historically been fussiest. Eager imports are resolved at build
 * time and cannot surprise us at the edge.
 *
 * ONLY list a locale here once it has a real, reviewed translation. A locale
 * present in this map is a locale we publish a URL for, and publishing
 * `/de` containing English text is worse than not publishing it at all: it is
 * duplicate content pointing at the same page, and a visitor who clicked
 * "Deutsch" and got English learns the switcher lies.
 */
const CATALOGS: Partial<Record<Locale, unknown>> = {
  en,
  "es-419": es419,
  "es-ES": esES,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  ja,
  "zh-TW": zhTW,
  "zh-CN": zhCN,
  ko,
  de,
  fr,
  pl,
  it,
  nl,
  ms,
  sv,
  da,
  nb,
  fi,
  cs,
  hu,
  uk,
  ru,
};

/** Locales with a catalog, in the display order defined by `LOCALES`. */
export function translatedLocales(): Locale[] {
  return Object.keys(CATALOGS) as Locale[];
}

export function hasCatalog(locale: Locale): boolean {
  return locale in CATALOGS;
}

/**
 * Deep-merges a locale's catalog over English.
 *
 * Per-key fallback, not per-file: a translator who has done half the page
 * leaves the other half in English rather than leaving it blank or crashing
 * the render. Arrays are replaced wholesale, never merged element-wise —
 * merging a 6-item FAQ over a 4-item translation would silently produce a
 * list that is half one language.
 */
function deepMerge<T>(base: T, overlay: unknown): T {
  if (overlay === undefined || overlay === null) return base;
  if (Array.isArray(base)) {
    return (Array.isArray(overlay) ? overlay : base) as T;
  }
  if (typeof base !== "object" || typeof overlay !== "object") {
    return (overlay ?? base) as T;
  }

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(
    overlay as Record<string, unknown>,
  )) {
    if (key in out) {
      out[key] = deepMerge((base as Record<string, unknown>)[key], value);
    }
  }
  return out as T;
}

/** Returns a fully-populated catalog for `locale`, English-filled. */
export function getMessages(locale: Locale): Messages {
  if (locale === DEFAULT_LOCALE) return en;
  const overlay = CATALOGS[locale];
  return overlay ? deepMerge(en, overlay) : en;
}

/**
 * Splits a string into text, `[label](https://url)` links and `` `code` ``
 * spans.
 *
 * The FAQ answers are the only copy on the site carrying inline markup, and
 * they use exactly these two features. Pulling in a markdown renderer to
 * handle two links and one `.ics` would be kilobytes of dependency to
 * reimplement `String.matchAll`.
 *
 * Anything that is not well-formed is returned as literal text, so a
 * translator who mangles a bracket gets visible brackets rather than a broken
 * link or an injection point. Only `https?://` URLs are recognised, so a
 * translated string can never introduce a `javascript:` href, and the URL is
 * never interpolated anywhere but into `href`.
 */
export type InlinePart =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string; href: string }
  | { kind: "code"; value: string };

const INLINE_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`/g;

export function parseInline(input: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;

  for (const match of input.matchAll(INLINE_RE)) {
    const at = match.index ?? 0;
    if (at > last) {
      parts.push({ kind: "text", value: input.slice(last, at) });
    }
    if (match[3] !== undefined) {
      parts.push({ kind: "code", value: match[3] });
    } else {
      parts.push({ kind: "link", value: match[1], href: match[2] });
    }
    last = at + match[0].length;
  }

  if (last < input.length) {
    parts.push({ kind: "text", value: input.slice(last) });
  }
  return parts;
}
