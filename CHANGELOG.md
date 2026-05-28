# Changelog

All notable changes to Houra will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [0.9.0] — 2026-05-28

### Phase 09 — Brand tokens + visual identity

Activates the design language approved in the Phase 08 PoC. Single font, consistent color palette, and team-facing documentation.

### Changed

- **Font**: DM Sans (300–700) is now the sole typeface. Inter, Roboto, and Encode Sans removed from the bundle.
- **Color palette**: CSS custom properties (`--h-*`) updated from wireframe grays to the approved blue-gray palette (`#F2F5FA` page, `#EEF2FA` surface, `#DDE1EC` borders, `#111111` text)
- **Page shell**: outer background `#F2F5FA` (was `#f5f5f5`)
- **Sidebar**: active nav item background → `#EEF2FA`; icon colors → `#111111` / `#9A9A9A`

### Added

- `docs/` — team-facing documentation folder
  - `docs/README.md` — index
  - `docs/phases.md` — what was built in each phase
  - `docs/adr/0001` – `0008` — Architecture Decision Records

[0.9.0]: https://github.com/guille-varela/houra/releases/tag/v0.9.0

---

## [0.7.0] — 2026-05-28

### Phase 07 — Audit log UI + exports + error handling

Completes the admin toolset: full audit trail UI with filtering and pagination, CSV/XLSX data exports, and a thorough error-handling cleanup across the app.

### Added

- `/audit` — Admin-only audit log page (50 entries per page, filter by entity type, colored action badges)
- `app/(app)/audit/audit-pagination.tsx` — Client component: entity type filter Select + Previous/Next pagination
- `app/(app)/audit/loading.tsx` — Skeleton loading state for audit log
- `/api/export/project/[id]` — Route handler: download all time entries for a project as CSV or XLSX
- `/api/export/workspace/[id]` — Route handler: download all time entries across a workspace's projects as CSV or XLSX (includes "Proyecto" column)
- Export buttons (CSV + Excel) in project Entradas tab and workspace detail header
- Settings → "Registro de actividad" card linking to `/audit`

### Fixed

- All user-facing error messages in `lib/guards.ts` changed from English technical strings to friendly Spanish microcopy
- All user-facing error messages in `lib/rates.ts` changed to Spanish
- `project.status` raw enum values no longer exposed in badges (`my-projects/page.tsx`)
- `deleteError` inline Alert in `today/today-client.tsx` migrated to toast notification
- Project status transition error in `actions/projects.ts` now shows a human-readable message
- Public report page (`app/r/[slug]`) now shows friendly copy for closed/expired states
- ActionIcon touch targets upgraded to `size="md"` or `size="lg"` (≥ 34px) across settings, share tab, time-off, and today views
- Dashboard project cards: `wrap="nowrap"` → `wrap="wrap"` to prevent overflow on mobile
- People page: PersonCard email now truncates correctly on narrow viewports

### Changed

- Server action errors surface via `notifications.show()` (toast) instead of inline Alert in `workspace-share-client.tsx` and `workspace-tabs.tsx`

### Performance

- Added composite DB index `project_assignments_person_active_idx` (`personId, isActive`) — speeds up "my active projects" queries
- Added composite DB index `time_entries_project_area_idx` (`projectId, area`) — speeds up matrix and cell-drill-down queries
- Migration: `db/migrations/0002_lumpy_lily_hollister.sql`

### Testing

- E2E suite with Playwright: `tests/e2e/login-imputar.spec.ts`, `tests/e2e/proyecto-asignar.spec.ts`, `tests/e2e/generar-report.spec.ts`
- `playwright.config.ts` — CI-only `webServer`; local tests assume a running dev server

[0.7.0]: https://github.com/guille-varela/houra/releases/tag/v0.7.0

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
