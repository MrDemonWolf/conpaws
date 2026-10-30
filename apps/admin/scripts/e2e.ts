import assert from "node:assert/strict";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:8788");
assert(
  ["localhost", "127.0.0.1"].includes(origin.hostname),
  "Run the admin smoke test against a local preview only.",
);

async function get(path: string) {
  const response = await fetch(new URL(path, origin));
  assert.equal(response.status, 200, path);
  return { response, body: await response.text() };
}

function assertSecurityHeaders(response: Response, path: string) {
  const contentSecurityPolicy =
    response.headers.get("content-security-policy") ?? "";
  assert.match(contentSecurityPolicy, /default-src 'self'/, path);
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/, path);
  assert(!contentSecurityPolicy.includes("'unsafe-eval'"), path);
  assert.equal(
    response.headers.get("permissions-policy"),
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    path,
  );
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", path);
  assert.equal(
    response.headers.get("strict-transport-security"),
    "max-age=63072000; includeSubDomains",
    path,
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
  assert.equal(response.headers.get("x-frame-options"), "DENY", path);
  assert.equal(response.headers.get("x-powered-by"), null, path);
}

const routes = {
  "/": "ConPaws Preview Con",
  "/conventions": "ConPaws Preview Con",
  "/activity": "Activity history",
  "/team": "Team",
  "/sign-in?error=email": "Sign in",
};

for (const [path, expectedText] of Object.entries(routes)) {
  const { response, body } = await get(path);
  assert.equal(response.redirected, false, `${path} redirected`);
  assert(body.includes("ConPaws Admin"), path);
  assert(body.includes(expectedText), path);
  assert.match(response.headers.get("cache-control") ?? "", /private/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assertSecurityHeaders(response, path);
}

assert((await get("/")).body.includes("ConPaws Preview Con"));
assert((await get("/conventions")).body.includes("ConPaws Preview Con"));
assert.match((await get("/robots.txt")).body, /Disallow:\s*\//);

const manifest = JSON.parse((await get("/manifest.webmanifest")).body);
assert.equal(manifest.name, "ConPaws Admin");
assert.match((await get("/offline.html")).body, /offline/i);
assert.match((await get("/sw.js")).body, /conpaws-admin-offline/);

console.log(
  "PASS: admin routes, private caching, security headers, robots, manifest, and offline shell",
);
