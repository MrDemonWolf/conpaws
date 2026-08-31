import { DEFAULT_LOCALE } from "@/i18n/config";
import { pickLocale } from "@/i18n/negotiate";
import { publishedLocales } from "@/i18n/routing";

/** localStorage key holding the locale this browser should be served. */
export const LOCALE_STORAGE_KEY = "conpaws.locale";

/**
 * Language auto-detection, and the behaviour the language menu needs.
 *
 * This renders one blocking inline script as the first thing in `<body>`, so
 * it runs before any of the page is painted. A redirect decided in a React
 * effect would show the English page first and then jump, and with the offline
 * service worker serving `/` from cache that flash is guaranteed rather than
 * occasional.
 *
 * The matching itself is `pickLocale`, serialised with `toString()` rather
 * than reimplemented here — see the note in `i18n/negotiate.ts` for why that
 * function has no imports. There is one implementation and it has tests.
 *
 * Four guards keep the redirect from being the thing people hate about
 * auto-translating sites:
 *
 *   - **Only on `/`.** Any other path is either an explicit locale someone
 *     typed or followed, or an English-only page (`/privacy`, `/terms`). A URL
 *     a visitor chose is never second-guessed.
 *   - **Only once.** The decision is written to localStorage immediately,
 *     including when the answer is "stay in English", so this runs on a
 *     browser's first visit and never again. Choosing from the menu overwrites
 *     it, which is what makes the override stick.
 *   - **`replace`, not `assign`.** Otherwise Back lands on `/`, which
 *     redirects again, and the button is dead.
 *   - **Never while offline.** The service worker has `/` cached but not
 *     necessarily `/de`, so redirecting offline can put English content under
 *     a German URL. Staying put is the honest failure.
 *
 * Crawlers are unaffected: this is client-side, so `/` is served as English to
 * anything that does not run scripts, and the hreflang set — not a redirect —
 * remains the canonical signal about which translations exist.
 *
 * It also corrects `<html lang>` from the URL. The root layout is shared by
 * every route and cannot know the locale, so the server renders `lang="en"`
 * everywhere and the page carries the real one on `<main lang>` instead — see
 * the note in `landing.tsx`. That is valid HTML, but screen readers choose a
 * voice from the root element, so a German page was being read aloud in an
 * English one. Fixing it here costs a line. Crawlers and no-script visitors
 * still get `lang="en"` with the correct `<main lang>` under it, exactly as
 * before, so this adds a fix without removing the fallback.
 *
 * The second half of the script is the language menu's behaviour: it records
 * an explicit choice, and closes the menu on outside-click and Escape. A
 * `<details>` element does neither on its own, and a dropdown that ignores
 * Escape is the sort of thing that reads as broken. It is here rather than in
 * a client component so the switcher keeps working before React hydrates —
 * someone who cannot read the current language is exactly the person who
 * should not be waiting on a bundle.
 */
export function LocaleDetect() {
  const script = `(function(){
var A=${JSON.stringify(publishedLocales())},D=${JSON.stringify(DEFAULT_LOCALE)},K=${JSON.stringify(LOCALE_STORAGE_KEY)};
var pick=${pickLocale.toString()};
function read(){try{return localStorage.getItem(K)}catch(e){return "?"}}
function write(v){try{localStorage.setItem(K,v)}catch(e){}}
var seg=location.pathname.split("/")[1];
if(seg&&A.indexOf(seg)>=0)document.documentElement.lang=seg;
if(location.pathname==="/"&&read()===null&&navigator.onLine!==false){
var L=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||""];
var best=pick(L,A);
write(best||D);
if(best&&best!==D)location.replace("/"+best+location.search+location.hash);
}
function shut(t){document.querySelectorAll("details[data-lang-menu][open]").forEach(function(d){if(!t||!d.contains(t)){d.open=false}})}
document.addEventListener("click",function(e){
var t=e.target;
var a=t&&t.closest?t.closest("[data-locale]"):null;
if(a){write(a.getAttribute("data-locale"));return}
shut(t);
});
document.addEventListener("keydown",function(e){
if(e.key!=="Escape")return;
var open=document.querySelector("details[data-lang-menu][open]");
if(!open)return;
open.open=false;
var s=open.querySelector("summary");
if(s)s.focus();
});
})();`;

  return (
    // Running before paint is the entire point, and the script is built from
    // build-time constants — no request data, no user input, nothing
    // interpolated that a visitor can reach.
    // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time constant script, see above
    <script dangerouslySetInnerHTML={{ __html: script }} />
  );
}
