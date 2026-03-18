# ConPaws — Go Live Checklist

## 0. Pre-flight

- [ ] Run `bun test` (should be 16/16)
- [ ] Commit all Phase 1D–1G changes to main
- [ ] Push to GitHub

---

## 1. API — Cloudflare Workers (`api.conpaws.com`)

- [ ] `cd apps/server && bun install`
- [ ] `wrangler login` (if not already authed)
- [ ] `wrangler secret put BREVO_API_KEY` (paste key when prompted)
- [ ] Verify `BREVO_LIST_ID` in `wrangler.toml` matches your actual Brevo list ID
- [ ] `wrangler deploy`
- [ ] Smoke test: `curl https://conpaws-api.workers.dev/health` → `{ "status": "ok" }`
- [ ] Add custom domain `api.conpaws.com` in Cloudflare Workers dashboard

---

## 2. Website — Cloudflare Pages (`conpaws.com`)

- [ ] In Cloudflare Pages: Create project → Connect GitHub repo
- [ ] Framework preset: **Next.js (static)**
- [ ] Build command: `cd apps/web && bun install && bun run build`
  - OR: Build command: `bun run build`, Root directory: `apps/web`
- [ ] Output directory: `apps/web/out`
- [ ] Add env var: `NEXT_PUBLIC_API_URL` = `https://api.conpaws.com`
- [ ] Deploy
- [ ] Add custom domain: `conpaws.com` (and `www.conpaws.com`)
- [ ] Verify: `conpaws.com` loads, `/privacy` and `/terms` work

> **Note:** `apps/web/next.config.ts` uses `output: 'export'` — static files go to `out/`.
> The `"start": "next start"` script in `apps/web/package.json` is **incompatible** with static export and must not be used for production. Cloudflare Pages ignores it, but it should be cleaned up post-launch (see step 5).

---

## 3. DNS

- [ ] `conpaws.com` → Cloudflare Pages (CNAME to `.pages.dev` URL, or use Cloudflare nameservers for automatic routing)
- [ ] `api.conpaws.com` → Workers custom domain (configured in step 1)
- [ ] `www.conpaws.com` → redirect to `conpaws.com` (set up in Cloudflare Pages → Custom domains)

---

## 4. Smoke Tests

- [ ] `GET  https://api.conpaws.com/health` → `{ "status": "ok" }`
- [ ] `POST https://api.conpaws.com/subscribe` with valid `name` + `email` → `200`
- [ ] `POST https://api.conpaws.com/subscribe` with honeypot field filled → `200` (silent success, no contact created)
- [ ] `https://conpaws.com` → hero, features, and signup form visible
- [ ] `https://conpaws.com/privacy` → loads
- [ ] `https://conpaws.com/terms` → loads
- [ ] Submit signup form on live site → contact appears in Brevo

---

## 5. Post-deploy

- [ ] Update `DEPLOY_WEB.md` to reflect Cloudflare Pages approach (not Coolify + `next start`)
- [ ] Set up auto-deploy: Cloudflare Pages deploys on every push to `main` (enable in Pages settings)
- [ ] Fix `apps/web/package.json` `start` script — remove or replace `"next start"` with a static serve alternative (e.g. `"serve out"` using the `serve` package), since it will never work with `output: 'export'`
