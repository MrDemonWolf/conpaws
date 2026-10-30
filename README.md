# ConPaws

A local-first furry convention companion: Expo mobile app, Next.js website and
admin console, with a Cloudflare Workers catalog API.

Project documentation, design notes, release guides and grades live in Notion:

- [ConPaws project home and report card](https://app.notion.com/p/3c8d61481c7b819d9d25c742524b4dc1)
- [Documentation library and source archive](https://app.notion.com/p/408d61481c7b818fb113ee3e0d930cb8)

## Local development

Use Bun 1.4.4 and Node 22.13.1, pinned in this repository.

```bash
bun install --frozen-lockfile
bun dev
```

Website: `http://localhost:3001`. Admin: `http://localhost:3003`.
Native runs through the Expo development server.

```bash
bun run test
bun check-types
bun lint
bun run security:audit
```

Read [AGENTS.md](AGENTS.md) for repository constraints. App-specific setup and
release procedures are in the Notion documentation library. Production deploys
run only through GitHub Actions on `main` after CI; do not deploy from a laptop.
