# Changelog

All notable changes to Houra will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [0.1.0] — 2026-05-25

### Phase 00 — Scaffold

First working scaffold. No business logic. All infrastructure wired.

### Added

- Next.js 16 (App Router) + React 19 + TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Mantine v9 in wireframe mode (neutral grayscale — no brand tokens until Phase 09)
- Tailwind 4 + `postcss-preset-mantine` + `postcss-simple-vars`
- Drizzle ORM + Neon serverless (`@neondatabase/serverless`)
- Better Auth with email/password and magic link via Resend
- Inngest endpoint at `/api/inngest` (empty functions, ready for Phases 05–06)
- React-PDF smoke test at `/api/pdf-test` (works locally; Cloudflare edge limitation documented)
- Empty authenticated routes: `/today`, `/projects`, `/time-off`, `/settings`
- Login placeholder at `/login`
- Shared app layout shell
- `lib/theme.ts` — Mantine wireframe theme (gray primary, Inter font, `sm` radius)
- `lib/db.ts` — Neon + Drizzle client
- `lib/auth.ts` — Better Auth config with lazy Resend initialization
- `lib/inngest.ts` — Inngest client
- `drizzle.config.ts` — Drizzle Kit config pointing to `db/schema/index.ts`
- `open-next.config.ts` — required by `@opennextjs/cloudflare` build
- `wrangler.toml` — Cloudflare Workers config (`nodejs_compat`, `main`, `assets` binding)
- GitHub Actions workflow: Neon branch preview for each PR (`.github/workflows/neon-preview.yml`)
- `.env.local.example` with all required variable names

### Infrastructure

- Deployed to Cloudflare Workers via `@opennextjs/cloudflare` v1.19.11
- Production URL: `https://houra.guillermo-varela.workers.dev`
- Secrets managed via `wrangler secret put` (not stored in repository)

### Decisions

- **Hosting**: Cloudflare Workers instead of Vercel (Vercel blocked at Gut due to corporate security incident — see ADR-0013)
- **Mantine v9** instead of v7 (v7 is not compatible with React 19)
- **Tailwind 4** installed alongside Next.js 16; PostCSS config adapted for Mantine v9
- **React-PDF**: known risk in Cloudflare edge runtime (500 in production). Mitigation planned for Phase 05.

### Known issues

- `GET /api/pdf-test` returns 500 in Cloudflare Workers (works locally). Root cause: `@react-pdf/renderer` depends on Node.js `canvas` which is not fully supported in the Cloudflare Workers edge runtime.
- CI/CD build command in Cloudflare dashboard currently set to `pnpm run build`. Needs to be updated to `pnpm build:cf`.

[0.1.0]: https://github.com/guille-varela/houra/releases/tag/v0.1.0
