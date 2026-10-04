import assert from "node:assert/strict";
import { LOCALE_CODES } from "../src/i18n/config";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:8787");
assert(
  ["localhost", "127.0.0.1"].includes(origin.hostname),
  "Run against a local preview; this check sends a disposable signup request.",
);

async function get(path: string) {
  const response = await fetch(new URL(path, origin));
  assert.equal(response.status, 200, path);
  return response.text();
}

for (const locale of LOCALE_CODES) {
  const html = await get(locale === "en" ? "/" : `/${locale}`);
  assert(html.includes(`<html lang="${locale}"`), locale);
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, locale);
  assert(html.includes('href="/updates"'), locale);
  assert(html.includes('href="#waitlist"'), locale);
  assert(/hreflang="x-default"/i.test(html), locale);
  assert(html.includes("https://schema.org/PreOrder"), locale);
}

for (const path of [
  "/privacy",
  "/terms",
  "/support",
  "/confirmed",
  "/updates",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/api/health",
]) {
  await get(path);
}
assert((await get("/updates")).includes("Release notes are on their way"));
assert((await get("/sitemap.xml")).includes("/updates"));
assert((await get("/llms.txt")).includes("/updates"));
assert.equal((await fetch(new URL("/missing-e2e-page", origin))).status, 404);

const count = JSON.parse(await get("/api/waitlist/count"));
assert.equal(count.count, null, "Unconfigured preview must not invent a count");
const submission = await fetch(new URL("/api/waitlist", origin), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "e2e@example.com",
    name: "E2E",
    elapsedMs: 3000,
  }),
});
assert.equal(submission.status, 503, "Unconfigured preview must fail closed");
console.log(
  "PASS: 23 locale pages, public routes, SEO, 404, and fail-closed signup",
);
