# Houra

Internal time tracker for Gut. Tracks hours per project, per person, and per cost matrix (area × role) to give real-time margin visibility.

> Phase 03 complete — project matrix dashboard live. Production: [houra.guillermo-varela.workers.dev](https://houra.guillermo-varela.workers.dev)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript strict |
| UI | Mantine v9 (wireframe mode) + Tailwind 4 |
| Database | Drizzle ORM + Neon (Postgres serverless) |
| Auth | Better Auth — email/password + magic link (Resend) |
| Background jobs | Inngest |
| PDF export | `@react-pdf/renderer` (⚠ edge limitation — see Known issues) |
| Deploy | Cloudflare Workers via `@opennextjs/cloudflare` |
| CI preview | Neon branch per PR (GitHub Actions) |

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Neon project (get the `DATABASE_URL` from the Neon dashboard)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template and fill in values
cp .env.local.example .env.local

# 3. Push the schema to your dev database
pnpm db:generate
pnpm db:migrate

# 4. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon connection string |
| `BETTER_AUTH_URL` | Yes | App base URL (e.g. `http://localhost:3000`) |
| `BETTER_AUTH_SECRET` | Yes | Random 32-char secret |
| `RESEND_API_KEY` | Magic link only | Resend API key |
| `RESEND_FROM_EMAIL` | Magic link only | Sender address |

---

## Scripts

```bash
pnpm dev           # Next.js dev server
pnpm build         # Standard Next.js build
pnpm build:cf      # Cloudflare Workers build (opennextjs-cloudflare)
pnpm preview:cf    # Local Cloudflare Workers preview
pnpm deploy:cf     # Deploy to Cloudflare Workers
pnpm typecheck     # TypeScript check (no emit)
pnpm db:generate   # Generate Drizzle migrations
pnpm db:migrate    # Apply migrations
pnpm db:studio     # Drizzle Studio (local DB UI)
```

---

## Project structure

```
app/                   # Next.js App Router
  (auth)/login/        # Login page
  (app)/               # Authenticated shell
    today/             # Daily time entry
    projects/          # Project list
    time-off/          # PTO management
    settings/          # User settings
  api/
    auth/[...all]/     # Better Auth handler
    inngest/           # Inngest endpoint
    pdf-test/          # PDF smoke test
db/
  schema/              # Drizzle schema (index.ts)
lib/
  auth.ts              # Better Auth config
  db.ts                # Neon + Drizzle client
  inngest.ts           # Inngest client
  theme.ts             # Mantine wireframe theme
```

---

## Deployment

The app deploys to Cloudflare Workers via `@opennextjs/cloudflare`.

```bash
# Build + deploy
pnpm build:cf && pnpm deploy:cf
```

Secrets are managed with `wrangler secret put` — never stored in the repository.

---

## Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 00 | Scaffold — infrastructure wired | ✅ Done |
| 01 | Data model + auth | ✅ Done |
| 02 | Time entry UI | ✅ Done |
| 03 | Project management + matrix dashboard | ✅ Done |
| 04 | Margin + amendments | ✅ Done |
| 05 | Reports + sharing | Pending |
| 06–08 | Background jobs, notifications, audit log | — |
| 09 | Brand tokens + final design | — |

---

## Known issues

- `GET /api/pdf-test` returns 500 in Cloudflare Workers. `@react-pdf/renderer` depends on Node.js `canvas`, which is not fully supported in the Cloudflare edge runtime. Mitigation planned for Phase 05.
- CI build command in Cloudflare dashboard is currently `pnpm run build`. It should be `pnpm build:cf`.

---

## License

Private — Gut internal use only.
