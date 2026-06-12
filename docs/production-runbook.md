# Houra — Production Runbook

Guía paso a paso para **configurar y deployar Houra a producción** sin depender de la memoria de nadie. Úsala cuando tengas que volver a deployar, rotar un secret, verificar el dominio de email o entender por qué un deploy falla.

> Producción: [houra.guillermo-varela.workers.dev](https://houra.guillermo-varela.workers.dev)

> ⚠️ **Regla de oro de este repo**: ningún valor de secret vive aquí. Este documento lista solo los **nombres** de las variables y **de dónde se obtienen**. Los valores reales se gestionan con `wrangler secret put` y nunca se commitean.

---

## Tabla de contenidos

1. [Stack y recursos](#1-stack-y-recursos)
2. [Cuentas Cloudflare (punto crítico)](#2-cuentas-cloudflare-punto-crítico)
3. [Build y deploy](#3-build-y-deploy)
4. [Mantener el bundle bajo 3 MiB](#4-mantener-el-bundle-bajo-3-mib)
5. [Variables de entorno y secrets](#5-variables-de-entorno-y-secrets)
6. [Email / Magic link (Resend)](#6-email--magic-link-resend)
7. [Inngest (background jobs)](#7-inngest-background-jobs)
8. [Migraciones de base de datos](#8-migraciones-de-base-de-datos)
9. [Pendiente manual en el dashboard de Cloudflare](#9-pendiente-manual-en-el-dashboard-de-cloudflare)
10. [Verificación de producción (checklist final)](#10-verificación-de-producción-checklist-final)
11. [Estado actual](#11-estado-actual)

---

## 1. Stack y recursos

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | Mantine v9 |
| ORM | Drizzle ORM |
| Base de datos | Neon Postgres (serverless), región `eu-west-2` |
| Auth | Better Auth — email/password + magic link |
| Background jobs | Inngest |
| Email | Resend |
| Deploy | Cloudflare Workers vía `@opennextjs/cloudflare` |

- **URL de producción**: `https://houra.guillermo-varela.workers.dev`
- **Worker**: `houra` (ver `wrangler.toml`).

Para el contexto de arquitectura interna (entidades, permisos, rutas) ver [architecture.md](architecture.md). Para el *por qué* del stack ver los [ADRs](adr/), en particular [ADR-0001 — Cloudflare Workers](adr/0001-cloudflare-workers.md).

---

## 2. Cuentas Cloudflare (punto crítico)

> 🛑 **Léelo antes de tocar `wrangler`. Es el error #1 de esta puesta en producción.**

El Worker `houra` vive en la **cuenta corporativa de Globant**:

| Dato | Valor |
|------|-------|
| Account ID | `9abf728949f498dee2e2f57a38e2d9df` |

El usuario tiene además una **segunda cuenta** Cloudflare personal (nodox.studio). Con 2 cuentas asociadas al mismo login, `wrangler` no sabe cuál usar y falla con:

```
Authentication error / Failed to retrieve account IDs
```

**Solución: anteponer `CLOUDFLARE_ACCOUNT_ID` a TODOS los comandos de wrangler.**

```bash
export CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df
```

O en línea, delante de cada comando (recomendado para no olvidarlo):

```bash
CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df pnpm exec wrangler <comando>
```

### Login

```bash
pnpm exec wrangler login     # interactivo, abre el navegador
pnpm exec wrangler whoami    # verificar la sesión y la cuenta
```

---

## 3. Build y deploy

### 1. Build para Cloudflare

```bash
pnpm build:cf      # = opennextjs-cloudflare build → genera .open-next/
```

### 2. Medir el tamaño ANTES de deployar

Esto es obligatorio: el plan Free de Workers tiene un límite duro de tamaño (ver sección 4).

```bash
CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df pnpm exec wrangler deploy --dry-run
```

Busca en la salida la línea:

```
Total Upload: ... / gzip: XXXX KiB
```

El valor `gzip` debe quedar **por debajo de 3072 KiB**.

### 3. Deploy real

```bash
CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df pnpm exec wrangler deploy
```

> El script `pnpm deploy:cf` (`opennextjs-cloudflare deploy`) hace lo mismo a más alto nivel, pero recuerda anteponer `CLOUDFLARE_ACCOUNT_ID` también ahí.

---

## 4. Mantener el bundle bajo 3 MiB

> ⚠️ **Límite duro: 3 MiB (3072 KiB) gzip en el plan Workers FREE.**

Si el worker supera ese tamaño, el deploy falla con:

```
code: 10027 — Worker exceeded the size limit of 3 MiB
```

Este límite mantuvo **producción congelada en una versión antigua** ("Phase 02") durante semanas: a medida que el proyecto creció, el bundle superó los 3 MiB y todos los deploys empezaron a fallar de forma silenciosa. El plan Paid sube el límite a 10 MiB ($5/mes), pero se decidió **NO pagar** y reducir el bundle.

### Advertencia técnica (léela antes de añadir dependencias pesadas)

> En Cloudflare Workers el `dynamic import()` **NO ayuda** a bajar del límite: todo el código termina empaquetado en el mismo worker. Para reducir tamaño hay que **ELIMINAR dependencias**, no solo lazy-loadearlas.

### Cómo se redujo (de 3225 KiB a 2837 KiB)

| Acción | Ahorro aprox. | Detalle |
|--------|---------------|---------|
| Eliminado `@react-pdf/renderer` + ruta `/api/pdf-test` | — | Daba 500 en el edge runtime (depende de `canvas` de Node). El PDF real se cubre con la ruta de impresión de carta-oferta (`window.print()`) + exports CSV |
| Eliminado `xlsx` (SheetJS) | ~510 KB | Los exports de datos ahora son **solo CSV con BOM UTF-8** (abre nativo en Excel con acentos). Se quitaron los botones "Excel" |
| Eliminado `@mantine/charts` + `recharts` | ~700 KB | `BurnRateChart` reescrito como SVG inline ligero en `components/projects/burn-rate-chart.tsx` |
| `experimental.optimizePackageImports` | — | Mejora el tree-shaking de los barrels de Mantine/tabler en `next.config.ts` |

---

## 5. Variables de entorno y secrets

Los secrets se configuran con `wrangler secret put` (el valor se pide por stdin, nunca va en el comando):

```bash
CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df pnpm exec wrangler secret put NOMBRE
```

> 🔒 **Solo nombres y procedencia. Los valores nunca se escriben aquí ni en el repo.**

| Secret | Módulo | De dónde se obtiene |
|--------|--------|---------------------|
| `DATABASE_URL` | Base | Neon dashboard (connection string, región `eu-west-2`) |
| `BETTER_AUTH_SECRET` | Base | Secreto aleatorio de 32 caracteres |
| `BETTER_AUTH_URL` | Base | URL base de la app de producción |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Vacaciones | Service account de Google Cloud |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Vacaciones | ID del spreadsheet objetivo |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Vacaciones | Private key de la service account |
| `VACATION_CALENDAR_ICAL_URL` | Vacaciones | URL iCal privada del Google Calendar |
| `RESEND_API_KEY` | Magic link | Resend dashboard → API Keys |
| `RESEND_FROM_EMAIL` | Magic link | Dirección de envío (actualmente `no-reply@nodox.studio`) |
| `INNGEST_SIGNING_KEY` | Inngest | app.inngest.com → entorno Production → Manage → Keys (formato `signkey-prod-...`) |
| `INNGEST_EVENT_KEY` | Inngest | app.inngest.com → entorno Production → Manage → Keys |

### Secret obsoleto

- `PDF_TEST_ENABLED` — era de la ruta react-pdf eliminada. **Se puede borrar.**

### Truco: cargar valores de `.env.local` que contienen `&`

`source .env.local` rompe el parseo de valores con `&` (como `DATABASE_URL`). En su lugar, extrae el valor con Node y pásalo por stdin a wrangler. Por ejemplo:

```bash
node -e "process.loadEnvFile('.env.local'); process.stdout.write(process.env.DATABASE_URL)" \
  | CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df pnpm exec wrangler secret put DATABASE_URL
```

---

## 6. Email / Magic link (Resend)

- **Servicio**: Resend, plan gratuito (3.000 emails/mes, 100/día). Verificar un dominio es gratis; solo cuesta comprar un dominio nuevo.
- **Dominio de envío**: `nodox.studio` (dominio personal del usuario).

> ⚠️ El DNS de `nodox.studio` **NO está en Cloudflare** sino en **Spaceship** (el registrar).
> Nameservers: `launch1.spaceship.net` / `launch2.spaceship.net`.

### Editar registros DNS en Spaceship

Spaceship → **Domain Manager** → selecciona el dominio → pestaña **DNS records** → **Add record**.
Campos: `Host`, `Type`, `Value`, `TTL` (y `Priority` para registros MX).

### Verificación del dominio en Resend — 4 registros DNS

Publica estos 4 registros en Spaceship y luego pulsa "Verify" en Resend:

| # | Type | Host | Value | Priority |
|---|------|------|-------|----------|
| 1 | `TXT` | `resend._domainkey` | DKIM: `p=...` (valor que da Resend) | — |
| 2 | `MX` | `send` | `feedback-smtp.eu-west-1.amazonses.com` | `10` |
| 3 | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | — |
| 4 | `TXT` | `_dmarc` | `v=DMARC1; p=none;` | — |

> Notas:
> - El **SPF se publica como `TXT`**, no existe un tipo de registro "SPF".
> - El valor DKIM completo lo da Resend; aquí va con placeholder `p=...` por limpieza (el registro es público porque vive en DNS).

### Tracking

En Resend se **desactivó click/open tracking**: el click tracking reescribe los enlaces, lo cual es indeseable en un magic link.

### Verificar propagación DNS

Consulta pública contra Google DNS (no esperes a la UI de Resend):

```bash
curl -s "https://dns.google/resolve?name=resend._domainkey.nodox.studio&type=TXT"
```

Cuando los registros estén propagados, pulsa "Verify" en Resend.

### Test de envío real

```bash
POST https://api.resend.com/emails    # con la RESEND_API_KEY
```

> ⚠️ **Limitación**: con el dominio de pruebas `onboarding@resend.dev` solo se puede enviar al propio email registrado. Con el dominio verificado se puede enviar a cualquiera.
>
> **Mejora futura**: usar un dominio de Gut/Globant en lugar del personal `nodox.studio` para producción definitiva.

---

## 7. Inngest (background jobs)

- **Cliente**: `lib/inngest.ts` → `new Inngest({ id: 'houra' })`.
- **Endpoint**: `app/api/inngest/route.ts` → `serve()`.
- Las keys (`INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`) se leen automáticamente del entorno; ver sección 5 para configurarlas.

> En producción `/api/inngest` devuelve **500 hasta que se configure `INNGEST_SIGNING_KEY`**.

### Sincronizar la app tras configurar las keys

Dashboard de Inngest → **Apps** → **Sync new app** → URL:

```
https://houra.guillermo-varela.workers.dev/api/inngest
```

Esto activa los jobs (p. ej. `auto-snapshot`).

---

## 8. Migraciones de base de datos

- ORM: Drizzle. Migraciones en `db/migrations/` (`0000`–`0005`, **6 migraciones** aplicadas en Neon).
- Aplicar:

```bash
pnpm db:migrate
```

- Verificar contra Neon consultando la tabla de control de Drizzle:

```sql
SELECT * FROM drizzle.__drizzle_migrations;
```

---

## 9. Pendiente manual en el dashboard de Cloudflare

> Necesario para que los **deploys automáticos no fallen**.

Cloudflare Workers dashboard → **houra** → **Settings** → **Build**: cambiar el build command de `pnpm run build` a:

```
pnpm build:cf
```

(El default de Next.js `pnpm run build` no genera el directorio `.open-next/` que el Worker necesita — ver [ADR-0001](adr/0001-cloudflare-workers.md).)

---

## 10. Verificación de producción (checklist final)

| Check | Comando | Esperado |
|-------|---------|----------|
| Home redirige | `curl -sI https://houra.guillermo-varela.workers.dev/` | `307` → `/today` |
| Login carga | `curl -sI https://houra.guillermo-varela.workers.dev/login` | `200` |
| Inngest activo | `curl -sI https://houra.guillermo-varela.workers.dev/api/inngest` | deja de dar `500` tras configurar las keys |

---

## 11. Estado actual

**Fecha: 2026-06-12**

✅ **Hecho:**
- Worker `houra` deployado en la cuenta corporativa de Globant (`9abf728949f498dee2e2f57a38e2d9df`).
- Bundle reducido de 3225 KiB a 2837 KiB (por debajo del límite de 3 MiB): eliminados `@react-pdf/renderer`, `xlsx`, `@mantine/charts` + `recharts`; `optimizePackageImports` activado en `next.config.ts`.
- 6 migraciones Drizzle (`0000`–`0005`) aplicadas en Neon.
- Dominio `nodox.studio` verificado en Resend (4 registros DNS publicados en Spaceship); click/open tracking desactivado.
- Secrets base, de Vacaciones y de Resend configurados vía `wrangler secret put`.

⏳ **Pendiente:**
- Configurar `INNGEST_SIGNING_KEY` e `INNGEST_EVENT_KEY` en producción y sincronizar la app en el dashboard de Inngest (`/api/inngest` dará 500 hasta entonces).
- Cambiar el build command en el dashboard de Cloudflare de `pnpm run build` a `pnpm build:cf` (sección 9).
- **A futuro**: migrar el dominio de envío de email del personal `nodox.studio` a un dominio de Gut/Globant para producción definitiva.
