# ADR-0011 — Motor analítico de Insights

**Date:** 2026-06-14
**Status:** Accepted — implementing (F3.5)
**Participants:** Guillermo Varela, Claude

---

## Context

F3.5 introduce la pantalla **Insights**: una vista de inteligencia de negocio para
Lead/Head/Manager con sumatorios y comparativas bajo múltiples lentes (slice & dice).
Las dimensiones de filtro son arbitrariamente combinables: cuenta/cliente, proyecto,
persona, categoría profesional, área, periodo (mes/trim/año/custom + comparativa
LY/LQ), rango de margen y status. Las visualizaciones incluyen KPIs, rankings,
donuts, líneas temporales y un heatmap `área × categoría`.

El feedback pedía explícitamente *"cálculos server-side con materialized views en
Postgres"*. Hay que decidir el motor de agregación equilibrando frescura,
performance, complejidad operativa y coste de compute en Neon.

### Hecho decisivo del modelo de datos

`time_entries` **denormaliza las tarifas en el momento del fichaje**
(`cost_rate_at_entry_cents`, `sold_rate_at_entry_cents`). Por tanto las tres métricas
financieras se calculan con un único `SUM` sobre una sola tabla, sin joins a tablas
de tarifas históricas:

- `revenue = Σ(hours × sold_rate)`
- `coste   = Σ(hours × cost_rate)`
- `margen  = (revenue − coste) / revenue`

Los únicos joins (a `persons` y `projects`) son a tablas-dimensión pequeñas y sirven
solo para filtrar/agrupar por categoría, cliente, status o tipo.

### Escala

Houra es el equipo de diseño de Gut: decenas de personas, no miles. Estimación
~25k `time_entries`/año → ~100k tras varios años. A esa escala, agregar on-the-fly
con índices es sub-100 ms.

---

## Decision

Adoptar el patrón **materialized** pedido en el feedback, pero implementado como una
**rollup table gestionada por Drizzle** (`insights_monthly`) en vez de un
`MATERIALIZED VIEW` nativo de Postgres, con un **read layer híbrido** que garantiza
frescura del mes en curso.

### 1. Rollup table a grano mensual

Tabla `insights_monthly` con grano `(organization_id, month, project_id, person_id,
area)` y medidas pre-agregadas `hours`, `revenue_cents`, `cost_cents`, `entry_count`.
Unique index sobre las 5 dimensiones del grano.

El grano mensual colapsa los múltiples fichajes diarios en un bucket por mes,
reduciendo el volumen ~1-2 órdenes de magnitud, y **sigue soportando todos los
slice/dice**: categoría profesional y cliente/status/tipo se resuelven por join a las
dimensiones (`persons`, `projects`) **en lectura**, no se materializan. Así los
cambios de categoría de una persona o de cliente de un proyecto se reflejan
correctamente sin reconstruir histórico (las dimensiones son slowly-changing y
guardamos los IDs, no los valores derivados).

### 2. Read layer híbrido (frescura sin coste de refresh on-write)

`lib/insights-data.ts` construye la fuente de hechos como:

- **meses pasados** (`month < date_trunc('month', now())`): se leen del rollup
  `insights_monthly` (rápido, prácticamente inmutable).
- **mes en curso**: se calcula **en vivo** desde `time_entries` (una sola partición
  mensual, indexada por `person+date` / `project`).

Ambas fuentes se unen (`UNION ALL`) y sobre el resultado se aplican filtros y
agrupaciones. Esto da datos **siempre frescos** para el periodo actual sin necesidad
de refrescar el rollup en cada escritura.

### 3. Refresh por cron nocturno

Una función Inngest (`refresh-insights`, cron `TZ=Europe/Madrid 0 1 * * *`)
reconstruye el rollup completo por organización (`DELETE` + `INSERT … SELECT … GROUP
BY`). El rebuild completo es barato a esta escala y evita lógica incremental. Cuando
un mes termina, el cron lo materializa y deja de calcularse en vivo.

### 4. Por qué rollup table y no `MATERIALIZED VIEW` nativo

- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requiere unique index sobre la vista y no
  encaja limpiamente con el flujo de migraciones de drizzle-kit (journal-based).
- Los matviews nativos siempre se recalculan enteros al refrescar; no ganamos
  incrementalidad respecto a un rebuild de tabla.
- Una `pgTable` normal está bajo control total de Drizzle (migración + índices +
  tipos de lectura) y es trivial de refrescar transaccionalmente desde un Worker.

El resultado honra la decisión del feedback (server-side, pre-computado) y es el
patrón "materialized" idiomático para Cloudflare Workers + Neon + Drizzle.

### 5. Permisos

Acceso a `/insights` solo para: `appRole ∈ {admin, manager}` **o**
`professionalCategory ∈ {lead, head}`. Los Contributors sin categoría Lead/Head no
acceden. (Lead/Head son **categorías profesionales**, no app roles: un Lead puede
tener `appRole = contributor` y aun así debe ver Insights.)

---

## Consequences

- Nueva tabla `insights_monthly` (migración additive, sin tocar datos existentes).
- Nuevo cron Inngest `refresh-insights`; suma carga nocturna mínima a Neon.
- El read layer vive en `lib/insights-data.ts` y usa SQL parametrizado para la fuente
  de hechos híbrida; las dimensiones de filtro se componen dinámicamente.
- Filtros persistentes en URL (`searchParams`) → vistas compartibles por enlace.
- Charts en SVG manual (sin libs, por el límite de bundle de Workers — ver práctica
  ya usada en `components/workspace/account-charts.tsx`).

### Umbral de revisión

Revisar esta decisión (p. ej. introducir `MATERIALIZED VIEW` nativo, refresh
on-write por evento Inngest, o rollups multi-grano) si se cumple alguno:

- una query de Insights supera ~500 ms p95, **o**
- `time_entries` supera ~500k filas, **o**
- aparecen dimensiones cuyo join en lectura deja de ser barato.
