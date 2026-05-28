# Houra — Phase Log

Registro de qué se construyó en cada fase. Útil para entender qué existe y por qué está donde está.

---

## Phase 00 — Scaffold · 2026-05-25

Infraestructura base. Sin lógica de negocio.

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Mantine v9 + Tailwind 4
- Drizzle ORM + Neon (Postgres serverless)
- Better Auth (email/password + magic link preparado)
- Inngest endpoint en `/api/inngest`
- Cloudflare Workers via `@opennextjs/cloudflare`
- GitHub Actions: Neon branch preview por PR

---

## Phase 01 — Data model + auth · 2026-05-25

- 19 tablas en `db/schema/`
- Tabla `persons` vinculada a `users` de Better Auth
- `lib/auth-helpers.ts` — `getCurrentPerson()`, `requireRole()`, `getOrganizationContext()`
- `lib/guards.ts` — validaciones tipadas (sin throws, retornan errores tipados)
- `lib/audit.ts` — `logAuditEvent()`
- `lib/rates.ts` — `resolveRate()` con jerarquía Persona > Proyecto > Workspace > Org
- Seed: org Gut + 3 personas + 18 tarifas + festivos 2026 (ES + 17 CCAA)

---

## Phase 02 — Time imputation core · 2026-05-25

- `actions/time-entries.ts` — `createTimeEntry` + `deleteTimeEntry`
- Login email/password
- Shell de app: layout + MobileNav (bottom nav en móvil)
- `/today` — vista "Mi día"
- `/week` — semana agrupada por día
- `/my-projects` — proyectos asignados (vista contributor)
- `db/fixtures.ts` — workspace y proyectos de ejemplo

---

## Phase 03 — Projects + matrix dashboard · 2026-05-26

- `lib/matrix.ts` — `buildMatrix`, `getProjectTotals`, `getProjectedEndDate`
- `/projects` — lista de proyectos (Admin + Manager)
- `/projects/[id]` — detalle con 4 tabs: Overview, Entradas, Equipo, Ajustes
- Matriz área × rol con traffic-light (verde <80%, naranja 80–99%, rojo ≥100%)
- Cell drill-down: drawer con personas que imputaron en esa celda
- Burn rate chart semanal (`@mantine/charts` + `recharts`)
- Fecha proyectada de finalización para proyectos con bolsa fija

> **Gotcha:** Los compound components de Mantine v9 (`Tabs.*`, `Table.*`) no resuelven en Turbopack Server Components. Solución: `Tabs` shell extraído a un wrapper `'use client'`; `Table.*` sustituidos por named exports (`TableThead`, `TableTbody`, etc.).

---

## Phase 04 — Margin + amendments · 2026-05-26

- Cálculo de margen real (coste vs. ingreso) por proyecto
- Tabla `amendments` para ajustes manuales de presupuesto
- Dashboard global `/dashboard` con KPIs por workspace

---

## Phase 05 — Reports + sharing · 2026-05-26

- Tabla `reports` + `report_snapshots`
- `/projects/[id]` → tab Share: crear report, compartir link, cerrar report
- `/r/[slug]` — vista pública del report (sin autenticación)
- Exports CSV/XLSX: `/api/export/project/[id]` y `/api/export/workspace/[id]`
- PDF: no implementado (ver [ADR-0001](adr/0001-cloudflare-workers.md))

---

## Phase 06 — Time off + Inngest + Slack · 2026-05-26

- `/time-off` — CRUD de días libres (vacaciones, festivos, bajas)
- Inngest: job `auto-snapshot` (snapshot semanal automático de proyectos activos)
- Slack notifications via Inngest (configurables por organización)

---

## Phase 07 — Audit log UI + exports · 2026-05-28

- `/audit` — página admin-only: tabla paginada de `audit_log_entries`, filtro por tipo, badges de acción
- Settings → card "Registro de actividad" enlaza a `/audit`

---

## Phase 08 — Polish · 2026-05-28

- Duplicación de proyectos (`duplicateProject`)
- 9 rutas con `loading.tsx` (Suspense / skeleton)
- Error handling estandarizado (ver [ADR-0008](adr/0008-error-handling.md))
- Touch targets ≥34px en móvil
- DB indexes: `project_assignments_person_active_idx`, `time_entries_project_area_idx`
- Suite E2E con Playwright (`tests/e2e/`)

---

## Phase 09 — Brand tokens + visual identity · 2026-05-28

- DM Sans como única fuente (Inter, Roboto, Encode Sans eliminados)
- Paleta azul-gris aplicada via CSS custom properties (`--h-*`)
- Ver [ADR-0006](adr/0006-dm-sans-palette.md) para los valores exactos
