# Changelog

All notable changes to Houra will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [0.4.0] — 2026-05-26

### Phase 03 — Projects + matrix dashboard

The centerpiece of Houra: project overview with the `(area × role)` consumption matrix.

### Added

- `/projects` — project list for Admin + Manager (role-guarded; contributors redirected to `/today`)
- `/projects/[id]` — project detail with four tabs: Overview, Entradas, Equipo, Ajustes
- **Overview tab**: `(area × role)` matrix with traffic-light coloring (green <80%, orange 80–99%, red ≥100%); unplanned consumption (no allocation set) shown as red cells
- **Cell drill-down**: click any active matrix cell to open a drawer listing every person who imputed hours in that (area × role) combination
- **Burn rate chart**: cumulative hours by ISO week (`@mantine/charts` + `recharts`)
- **Projected end date** for `fixed_bag` and `renewable_bag` project types (based on weekly consumption rate)
- **Top contributors** list (top 5 by hours)
- **Entradas tab**: paginated table of all time entries for the project (last 200)
- **Equipo tab** (Admin only): list active assignments, add/remove people, set `allowed_areas` per person
- **Ajustes tab** (Admin only): status transitions (draft → active → paused → closed; active → draft blocked), editable allocation matrix (unlocked only in `draft` status)
- `lib/matrix.ts` — pure functions: `buildMatrix`, `getProjectTotals`, `getProjectedEndDate`
- `lib/schemas/project.ts` — Zod schemas + `isValidTransition` guard
- `actions/projects.ts` — `updateProjectStatus`, `updateAllocation` (both audit-logged)
- `actions/project-assignments.ts` — `upsertAssignment`, `deactivateAssignment` (both audit-logged)
- `actions/projects-query.ts` — `getCellEntries` server action for cell drill-down

### Dependencies

- `@mantine/charts@9.2.1` + `recharts@3.8.1`

### Decisions

- Mantine compound components (`Tabs.*`, `Table.*`) don't resolve in Turbopack Server Components — workaround: `Tabs` shell extracted to a `'use client'` wrapper (`ProjectTabs`); `Table.*` replaced with standalone named exports (`TableThead`, `TableTbody`, etc.) in Server Components
- Unplanned consumption (consumed > 0, planned = 0) shown as red cell with raw hours instead of percentage — more informative than hiding the data

[0.4.0]: https://github.com/guille-varela/houra/releases/tag/v0.4.0

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
