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
9. [CI: Cloudflare Workers Builds (deploy automático)](#9-ci-cloudflare-workers-builds-deploy-automático)
10. [Verificación de producción (checklist final)](#10-verificación-de-producción-checklist-final)
11. [Gotchas y lecciones aprendidas](#11-gotchas-y-lecciones-aprendidas)
12. [Estado actual](#12-estado-actual)

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
| `BETTER_AUTH_URL` | Base | URL base de la app de producción — **fijar a `https://houra.guillermo-varela.workers.dev`** (ver gotcha abajo) |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Vacaciones | Service account de Google Cloud |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Vacaciones | ID del spreadsheet objetivo |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Vacaciones | Private key de la service account |
| `VACATION_CALENDAR_ICAL_URL` | Vacaciones | URL iCal privada del Google Calendar |
| `RESEND_API_KEY` | Magic link | Resend dashboard → API Keys |
| `RESEND_FROM_EMAIL` | Magic link | Dirección de envío (actualmente `no-reply@nodox.studio`) |
| `INNGEST_SIGNING_KEY` | Inngest | app.inngest.com → entorno Production → Manage → Keys (formato `signkey-prod-...`) |
| `INNGEST_EVENT_KEY` | Inngest | app.inngest.com → entorno Production → Manage → Keys |

### `BETTER_AUTH_URL` (server-side) vs `NEXT_PUBLIC_BETTER_AUTH_URL` (client-side)

Son dos cosas distintas y es fácil confundirlas:

- **Server-side** — `lib/auth.ts` usa `baseURL: process.env.BETTER_AUTH_URL!` para generar los enlaces del **magic link**. Si este secret quedara en `localhost`, los magic links saldrían apuntando a localhost y no funcionarían. Debe estar fijado a `https://houra.guillermo-varela.workers.dev`.
- **Client-side** — `lib/auth-client.ts` ya **no** usa `NEXT_PUBLIC_BETTER_AUTH_URL`: el `createAuthClient()` se construye sin `baseURL`, así Better Auth usa el origin actual del navegador (el auth se sirve desde el mismo Worker en `/api/auth/*`). Esto elimina toda dependencia de variables build-time, por eso **"Build variables: None"** en el CI es lo correcto (ver el gotcha de `localhost` horneado).

> ⚠️ **`wrangler secret put` es interactivo** (pide el valor por stdin). En un contexto no-interactivo (script, agente) hay que pasar el valor por pipe, o subirás un secret **vacío**:
> ```bash
> printf '%s' 'https://houra.guillermo-varela.workers.dev' \
>   | CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df pnpm exec wrangler secret put BETTER_AUTH_URL
> ```

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

> 🧭 **Usa la pestaña correcta**:
> - **DNS records** → es donde se añaden estos registros (la que necesitas).
> - **Advanced DNS** → NO; es para cambiar nameservers.
> - **DNS Preset Manager** → NO; son plantillas predefinidas.
>
> En el campo **Host** se pone solo el **prefijo relativo** (`resend._domainkey`, `send`, `_dmarc`); Spaceship añade el dominio automáticamente. El SPF y el DMARC se publican como tipo **`TXT`** — no existen tipos de registro "SPF" ni "DMARC".

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

### Obtener las keys (cuenta nueva)

app.inngest.com → selecciona el entorno **Production** → **icono de llave** (Manage → Keys):

- `INNGEST_SIGNING_KEY` → formato `signkey-prod-...`
- `INNGEST_EVENT_KEY`

> 💡 En una cuenta nueva, **salta el onboarding wizard** del dev server local — no es necesario para configurar producción.

### Estado del endpoint según las keys

- **Sin `INNGEST_SIGNING_KEY`** → `/api/inngest` devuelve **500**.
- **Con las keys configuradas** → pasa a **401**: el endpoint ya responde, pero **rechaza accesos sin firma** (comportamiento correcto; no es un error).

### Sincronizar la app tras configurar las keys

> El sync debe hacerse **DESPUÉS** de configurar el `INNGEST_SIGNING_KEY`.

Dashboard de Inngest → **Apps** → **Sync new app** (sincronización **manual**, no vía Vercel) → URL:

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

## 9. CI: Cloudflare Workers Builds (deploy automático)

El deploy automático está conectado vía **Cloudflare Workers Builds** al repo `guille-varela/houra`. Cada push a `main` dispara: **build + deploy**.

### Configuración del CI (dashboard de Cloudflare)

Cloudflare Workers dashboard → **houra** → **Settings** → **Build**:

| Ajuste | Valor |
|--------|-------|
| Build command | `pnpm build:cf` |
| Deploy command | `npx wrangler deploy` |
| Build variables | **None** (no se necesitan variables build-time — ver gotcha de `localhost` horneado en sección 11) |

> El default de Next.js `pnpm run build` **no** genera el directorio `.open-next/` que el Worker necesita — por eso el build command debe ser `pnpm build:cf` (ver [ADR-0001](adr/0001-cloudflare-workers.md)).

### Cadena de fallos resuelta

El CI estaba conectado pero **nunca había llegado a funcionar**. Estos fueron los fallos, en cadena, y su fix. Sirven de checklist si el CI vuelve a romperse:

| Error en el CI | Causa | Fix |
|----------------|-------|-----|
| `packages field missing or empty` | El CI usaba `pnpm@10.11.1`, que falla con un `pnpm-workspace.yaml` que solo tiene `ignoredBuiltDependencies` (sin campo `packages`) | Declarar `"packageManager": "pnpm@10.32.1"` en `package.json` para forzar la versión que sí lo tolera |
| `Can't resolve '@mantine/charts/styles.css'` | Al eliminar `@mantine/charts` quedó un `@import` huérfano en `app/globals.css`. El build local pasaba por un `node_modules` residual; el CI parte de uno limpio | Quitar el `@import` huérfano de `globals.css` |
| `No database connection string was provided to neon()` | `lib/db.ts` creaba el cliente Neon a nivel de módulo, evaluado en build-time por `next build` (collect page data), pero `DATABASE_URL` es un **runtime secret** ausente en el CI | Inicialización **lazy** con un `Proxy` (el cliente Neon se crea al primer uso en runtime — ver `lib/db.ts`) |

Resultado: **CI verde de punta a punta**, deploy automático funcionando (push a `main` → build + deploy).

### Técnica de verificación clave: reproducir el CI en local

Antes de pushear cambios que toquen **dependencias** o la **inicialización de servicios** (clientes de DB, auth, etc.), reproduce el entorno limpio del CI buildeando **sin** `.env.local`:

```bash
mv .env.local .env.local.bak && pnpm build:cf
# ...revisar el resultado...
mv .env.local.bak .env.local      # restaurar
```

Esto destapa de una sola pasada todos los fallos de build-time que dependen de secrets (los tres de la tabla de arriba surgieron así), porque el build local con un `.env.local` de desarrollo y un `node_modules` residual los oculta.

---

## 10. Verificación de producción (checklist final)

| Check | Comando | Esperado |
|-------|---------|----------|
| Home redirige | `curl -sI https://houra.guillermo-varela.workers.dev/` | `307` → `/today` |
| Login carga | `curl -sI https://houra.guillermo-varela.workers.dev/login` | `200` |
| Inngest activo | `curl -sI https://houra.guillermo-varela.workers.dev/api/inngest` | `500` sin keys → `401` con las keys configuradas (responde, rechaza accesos sin firma) |

---

## 11. Gotchas y lecciones aprendidas

Resumen de las trampas que costaron tiempo en esta puesta en producción. Léelas antes de tocar build, deploy o DNS.

- **Build con `.env.local` de desarrollo hornea `localhost`** — las `NEXT_PUBLIC_*` se fijan en build-time; un bundle de producción buildeado con un `.env.local` de dev queda apuntando a `localhost`. Verifica el bundle de producción o, mejor, evita depender de esas variables (el `authClient` ya no las usa).
- **El límite de 3 MiB de Workers Free congela producción en silencio** — al crecer el bundle, los deploys empiezan a fallar **sin avisar** y producción se queda en una versión antigua. Mide con `wrangler deploy --dry-run` antes de cada deploy (sección 4).
- **Dos cuentas (Cloudflare y GitHub) en la misma máquina** — verifica la identidad antes de cualquier deploy/push: `CLOUDFLARE_ACCOUNT_ID=9abf728949f498dee2e2f57a38e2d9df` para wrangler y `gh auth switch --user guille-varela` para GitHub.
- **El DNS de un dominio no siempre está donde crees** — `nodox.studio` se gestiona en **Spaceship**, no en Cloudflare. Verifica los nameservers (`dig NS nodox.studio`) antes de buscar dónde editar registros.
- **Tokens de API sobre-permisivos / cuenta equivocada** — usa la plantilla mínima ("Edit zone DNS") con scope a una **sola zona**, no un token con acceso total a la cuenta.
- **Al quitar una dependencia, limpia también sus imports de CSS** — al eliminar `@mantine/charts` quedó un `@import '@mantine/charts/styles.css'` huérfano en `app/globals.css` que tumbó el CI.
- **`node_modules` residual local oculta fallos que el CI limpio detecta** — reproduce el CI buildeando sin `.env.local` y con un `node_modules` sincronizado al lockfile (sección 9).
- **Clientes externos (`neon()`, etc.) inicializados en top-level fallan en build sin secrets** — `next build` evalúa el módulo en build-time, donde el runtime secret no existe. Usa inicialización **lazy** (ver el `Proxy` de `lib/db.ts`).
- **`wrangler secret put` es interactivo** — en contextos no-interactivos pasa el valor por pipe (`printf '%s' 'valor' | ... wrangler secret put NOMBRE`); si no, subirás un secret **vacío**.
- **La versión de pnpm del CI puede diferir de la local** — fija `"packageManager"` en `package.json` (`pnpm@10.32.1`) para que CI y local usen la misma.

---

## 12. Estado actual

**Fecha: 2026-06-12**

✅ **Hecho:**
- Worker `houra` deployado en la cuenta corporativa de Globant (`9abf728949f498dee2e2f57a38e2d9df`) y **producción al día** (ya no congelada en "Phase 02").
- Bundle reducido de 3225 KiB a 2837 KiB (por debajo del límite de 3 MiB): eliminados `@react-pdf/renderer`, `xlsx`, `@mantine/charts` + `recharts`; `optimizePackageImports` activado en `next.config.ts`.
- 6 migraciones Drizzle (`0000`–`0005`) aplicadas en Neon.
- **Magic link operativo**: dominio `nodox.studio` verificado en Resend (4 registros DNS publicados en Spaceship); click/open tracking desactivado; `BETTER_AUTH_URL` fijado a producción.
- **Inngest operativo**: `INNGEST_SIGNING_KEY` e `INNGEST_EVENT_KEY` configuradas y app sincronizada (`/api/inngest` responde `401` ante accesos sin firma).
- **CI verde de punta a punta**: Cloudflare Workers Builds conectado a `guille-varela/houra`; push a `main` → build (`pnpm build:cf`) + deploy automático.
- Secrets base, de Vacaciones y de Resend configurados vía `wrangler secret put`.

⏳ **Pendiente:**
- **A futuro**: migrar el dominio de envío de email del personal `nodox.studio` a un dominio de Gut/Globant para producción definitiva.
