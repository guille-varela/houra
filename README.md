# Houra

Internal time tracker and team visibility tool for Gut. Tracks hours per project, per person, and per cost matrix (area × role) with real-time margin visibility. Includes a full vacation management module with Gantt view, overlap warnings, and Google Sheets/Calendar integration.

> Production: [houra.guillermo-varela.workers.dev](https://houra.guillermo-varela.workers.dev)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript strict |
| UI | Mantine v9 + Tailwind 4 |
| Database | Drizzle ORM + Neon (Postgres serverless) |
| Auth | Better Auth — email/password + magic link (Resend) |
| Background jobs | Inngest |
| Oferta / PDF | Impresión del navegador (`window.print()` en la carta-oferta) |
| Data export | CSV con BOM UTF-8 (acentos correctos en Excel) |
| Deploy | Cloudflare Workers via `@opennextjs/cloudflare` (`pnpm build:cf`) |

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Neon project (`DATABASE_URL` from the Neon dashboard)

### Setup

```bash
pnpm install
cp .env.local.example .env.local   # fill in values
pnpm db:migrate
pnpm db:seed
pnpm db:fixtures
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon connection string |
| `BETTER_AUTH_URL` | Yes | App base URL (`http://localhost:3000`) |
| `BETTER_AUTH_SECRET` | Yes | Random 32-char secret |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Yes | App base URL for client-side auth |
| `RESEND_API_KEY` | Magic link only | Resend API key |
| `RESEND_FROM_EMAIL` | Magic link only | Sender address |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Vacaciones | Service account email |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Vacaciones | Service account private key |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Vacaciones | Target spreadsheet ID |
| `VACATION_CALENDAR_ICAL_URL` | Vacaciones | Private iCal URL from Google Calendar |

---

## Scripts

```bash
pnpm dev              # Next.js dev server
pnpm build:cf         # Cloudflare Workers build
pnpm deploy:cf        # Deploy to Cloudflare Workers

pnpm db:migrate       # Apply migrations
pnpm db:seed          # Org + 3 demo users + rates + holiday presets 2026
pnpm db:seed-2027     # Holiday presets 2027 (ES + ES-MD + ES-CL)
pnpm db:seed-team     # Full team (25 people, @houra.com emails, password: @houra)
pnpm db:seed-roles    # Update professional categories and disciplines
pnpm db:fixtures      # Workspaces + projects + assignments
pnpm db:studio        # Drizzle Studio
```

---

## Project structure

```
app/
  (auth)/login/          Login
  (app)/
    today/               Daily time entry
    week/                Weekly view
    projects/            Project list + matrix dashboard
    proposals/           Proposals pipeline
    clients/             Client management
    people/              Team directory
    time-off/            PTO management
    vacaciones/          Team vacation view (Gantt + Saldos + Equipo)
    dashboard/           Management dashboard
    settings/            Settings + rates
  (print)/               Print-only layout (PDF proposals)
components/
  vacaciones/
    gantt-vacaciones.tsx  5-month Gantt with regional holidays
    vacaciones-client.tsx Tab switcher + search + drawer
lib/
  sheets-vacaciones.ts   Google Sheets parser (values + colors APIs)
  vacation-calendar.ts   iCal parser (Google Calendar)
db/
  schema/                Drizzle schema
  seed*.ts               Seed scripts
```

---

## Vacation module

The `/vacaciones` page integrates two external sources:

| Source | What it provides |
|--------|-----------------|
| Google Sheets | Days balance (n, n-1, used, remaining) + cell colors (approved/pending) |
| Google Calendar (iCal) | Events from "Vacaciones Product" calendar |

Features:
- **Gantt** — 5-month timeline auto-scrolled to today, regional holiday shading per person, tooltip per bar, paternity leave in violet
- **Saldos** — table sorted by days remaining, n-1 expiry alerts
- **Equipo** — card grid; click any card to open a detail drawer (ring chart, balance, baja/excedencia/paternal status, overlap alerts, period history)
- **iCal calendar** — Ahora / Próximas / Últimas 2 semanas always at the top
- **Overlap warnings** — lead/dept conflicts, paternity leave alerts, general overlaps
- **Search** — real-time filter by name, month, status, alerta, bekind

Access control: `isBaja` and `isExcedencia` people visible to manager/admin only. CRO team shown as a separate group.

### Dev credentials

All team accounts: `nombre.apellido@houra.com` / `@houra`
Demo accounts: `admin@gut.com`, `manager@gut.com`, `contributor@gut.com` / `@houra`

---

## Deployment

El Worker `houra` vive en la **cuenta corporativa de Cloudflare (Globant)**. Como hay 2 cuentas Cloudflare asociadas a la máquina, todos los comandos de `wrangler` necesitan el account ID por delante:

```bash
# Build local
pnpm build:cf

# Deploy manual
CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df wrangler deploy
```

**CI automático**: push a `main` dispara Cloudflare Workers Builds (build `pnpm build:cf` + deploy `npx wrangler deploy`).

> ⚠️ **Límite de 3 MiB gzip** del plan Workers Free. El bundle ronda los 2834 KiB; mantener las dependencias controladas antes de añadir paquetes pesados.

Secrets gestionados con `wrangler secret put` (los valores nunca se commitean).

**Guía completa** de deploy, secrets, DNS y cuentas Cloudflare: [docs/production-runbook.md](docs/production-runbook.md).

---

## Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| 00 | Scaffold | ✅ |
| 01 | Data model + auth | ✅ |
| 02 | Time entry UI | ✅ |
| 03 | Project management + matrix dashboard | ✅ |
| 04 | Margin + amendments | ✅ |
| 05 | Reports + sharing | ✅ |
| 06 | Time off + Inngest + Slack | ✅ |
| 07 | Audit log UI + exports (CSV con BOM UTF-8) | ✅ |
| 08 | Polish — loading, toasts, mobile, microcopy | ✅ |
| 09 | Visual identity (DM Sans + paleta azul-gris) | ✅ |
| Vacaciones | Google Sheets + Calendar + Gantt + team DB | ✅ |

---

## Estado de producción

- **Magic link**: operativo. Resend con el dominio `nodox.studio` verificado; remitente `no-reply@nodox.studio`.
- **Inngest**: operativo. Keys configuradas y app sincronizada en el dashboard de Inngest.

> A futuro: migrar el remitente del dominio personal `nodox.studio` a un dominio de Gut/Globant. Ver [docs/production-runbook.md](docs/production-runbook.md).

---

## License

Private — Gut internal use only.
