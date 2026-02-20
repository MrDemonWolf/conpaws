# Deploying ConPaws Web via Coolify

This guide covers deploying the `apps/web` Next.js site to a Coolify instance.

## Prerequisites

- A running [Coolify](https://coolify.io) instance (self-hosted)
- A domain pointed to your Coolify server (e.g. `conpaws.app`)
- The ConPaws repo pushed to GitHub/GitLab

## Step 1: Create a New Resource in Coolify

1. Open your Coolify dashboard
2. Go to **Projects** → select your project (or create one)
3. Click **+ New Resource** → **Application**
4. Connect your Git repository (GitHub/GitLab)
5. Select the `main` branch (or whichever branch you deploy from)

## Step 2: Configure Build Settings

| Setting | Value |
|---------|-------|
| Build Pack | **Nixpacks** (auto-detected) or **Dockerfile** |
| Base Directory | `apps/web` |
| Build Command | `pnpm build` |
| Start Command | `pnpm start` |
| Install Command | `pnpm install` |
| Port | `3000` |

> **Monorepo note:** Set the **Base Directory** to `apps/web` so Coolify builds from the correct workspace. If Coolify doesn't support base directories natively, use a Dockerfile instead (see below).

## Step 3: Environment Variables

Add any required env vars in Coolify's **Environment Variables** tab:

```
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://conpaws.app
```

## Step 4: Domain & SSL

1. Go to the **Domains** tab in your resource settings
2. Add your domain: `conpaws.app` (and `www.conpaws.app` if desired)
3. Enable **Auto SSL** — Coolify handles Let's Encrypt certificates automatically

## Step 5: Deploy

Click **Deploy** or push to the configured branch. Coolify will:

1. Clone the repo
2. Install dependencies (`pnpm install`)
3. Build the Next.js app (`pnpm build` in `apps/web`)
4. Start the production server on port 3000
5. Proxy traffic from your domain with SSL

## Dockerfile Alternative

If Coolify has trouble with the monorepo structure, add this Dockerfile at `apps/web/Dockerfile`:

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
WORKDIR /app/apps/web
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
```

Then in Coolify, set **Build Pack** to **Dockerfile** and point to `apps/web/Dockerfile`.

> **Important:** For the standalone output to work, add `output: "standalone"` to your `next.config.js`.

## Auto-Deploy on Push

In Coolify's resource settings, enable **Auto Deploy** to redeploy on every push to your configured branch. Alternatively, use Coolify's webhook URL in your GitHub repo settings for manual control.

## Health Checks

Coolify supports health checks. Set the health check path to `/` or create an `/api/health` route in Next.js:

```ts
// apps/web/src/app/api/health/route.ts
export function GET() {
  return Response.json({ status: "ok" });
}
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on monorepo | Use the Dockerfile approach instead of Nixpacks |
| Port not accessible | Verify port is set to `3000` in Coolify |
| SSL not working | Check DNS A record points to your Coolify server IP |
| Old version deployed | Clear build cache in Coolify and redeploy |
| pnpm not found | Ensure Nixpacks detects `pnpm-lock.yaml`, or use the Dockerfile |
