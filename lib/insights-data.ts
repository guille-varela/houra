import { sql, type SQL } from 'drizzle-orm'
import { db } from './db'
import {
  INSIGHTS_AREAS,
  INSIGHTS_CATEGORIES,
  AREA_LABELS,
  CATEGORY_LABELS,
  resolveMonthRange,
  resolveCompareRange,
  matchesBucket,
  marginPct,
  type InsightsFilters,
} from './insights-filters'

/**
 * F3.5 — Capa de datos de Insights (ver ADR-0011).
 *
 * Una sola query trae las filas de hechos filtradas, uniendo el rollup mensual
 * (`insights_monthly`, meses pasados) con el cálculo en vivo del mes en curso desde
 * `time_entries`. Todos los agregados (KPIs, rankings, donuts, líneas, heatmap) se
 * computan en TypeScript a partir de esas filas — el volumen tras el rollup mensual
 * es pequeño.
 */

// ─── Fila de hechos enriquecida ─────────────────────────────────────────────────

export type FactRow = {
  month: string // 'YYYY-MM'
  projectId: string
  projectName: string
  projectStatus: string
  clientId: string | null
  clientName: string | null
  workspaceId: string | null
  personId: string
  personName: string
  category: string
  area: string
  hours: number
  revenueCents: number
  costCents: number
}

function inUuid(col: SQL, ids: string[]): SQL {
  return sql`${col} in (${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`
}
function inText(col: SQL, vals: string[]): SQL {
  return sql`${col} in (${sql.join(
    vals.map((v) => sql`${v}`),
    sql`, `,
  )})`
}

async function fetchFactRows(
  orgId: string,
  f: InsightsFilters,
  range?: { fromMonth: string; toMonth: string },
): Promise<FactRow[]> {
  const { fromMonth, toMonth } = range ?? resolveMonthRange(f)

  const conds: SQL[] = [sql`f.month >= ${fromMonth}::date`, sql`f.month <= ${toMonth}::date`]
  if (f.clientIds.length) conds.push(inUuid(sql`pr.client_id`, f.clientIds))
  if (f.workspaceIds.length) conds.push(inUuid(sql`pr.workspace_id`, f.workspaceIds))
  if (f.projectIds.length) conds.push(inUuid(sql`f.project_id`, f.projectIds))
  if (f.personIds.length) conds.push(inUuid(sql`f.person_id`, f.personIds))
  if (f.categories.length) conds.push(inText(sql`p.professional_category::text`, f.categories))
  if (f.areas.length) conds.push(inText(sql`f.area`, f.areas))
  if (f.statuses.length) conds.push(inText(sql`pr.status::text`, f.statuses))

  const where = sql.join(conds, sql` and `)

  const query = sql`
    with facts as (
      select organization_id, month, project_id, person_id, area, hours, revenue_cents, cost_cents
      from insights_monthly
      where organization_id = ${orgId} and month < date_trunc('month', now())::date
      union all
      select
        te.organization_id,
        date_trunc('month', te.date::date)::date as month,
        te.project_id,
        te.person_id,
        te.area,
        sum(te.hours) as hours,
        round(sum(te.hours * te.sold_rate_at_entry_cents))::bigint as revenue_cents,
        round(sum(te.hours * te.cost_rate_at_entry_cents))::bigint as cost_cents
      from time_entries te
      where te.organization_id = ${orgId} and te.date >= date_trunc('month', now())::date
      group by te.organization_id, date_trunc('month', te.date::date)::date,
               te.project_id, te.person_id, te.area
    )
    select
      to_char(f.month, 'YYYY-MM') as month,
      f.project_id as "projectId",
      pr.name as "projectName",
      pr.status::text as "projectStatus",
      pr.client_id as "clientId",
      c.name as "clientName",
      pr.workspace_id as "workspaceId",
      f.person_id as "personId",
      p.name as "personName",
      p.professional_category::text as category,
      f.area as area,
      f.hours::float8 as hours,
      f.revenue_cents as "revenueCents",
      f.cost_cents as "costCents"
    from facts f
    join projects pr on pr.id = f.project_id
    left join clients c on c.id = pr.client_id
    join persons p on p.id = f.person_id
    where ${where}
  `

  const res = await db.execute(query)
  const rows = ((res as { rows?: unknown[] }).rows ?? (res as unknown as unknown[])) as Array<
    Record<string, unknown>
  >

  let facts: FactRow[] = rows.map((r) => ({
    month: String(r.month),
    projectId: String(r.projectId),
    projectName: String(r.projectName ?? '—'),
    projectStatus: String(r.projectStatus ?? 'draft'),
    clientId: r.clientId ? String(r.clientId) : null,
    clientName: r.clientName ? String(r.clientName) : null,
    workspaceId: r.workspaceId ? String(r.workspaceId) : null,
    personId: String(r.personId),
    personName: String(r.personName ?? '—'),
    category: String(r.category ?? 'mid'),
    area: String(r.area ?? 'ux'),
    hours: Number(r.hours ?? 0),
    revenueCents: Number(r.revenueCents ?? 0),
    costCents: Number(r.costCents ?? 0),
  }))

  // Filtro de rango de margen: a nivel de proyecto (margen del proyecto en el
  // periodo). Se computa en JS tras la query.
  if (f.marginBucket) {
    const byProject = new Map<string, { rev: number; cost: number }>()
    for (const row of facts) {
      const acc = byProject.get(row.projectId) ?? { rev: 0, cost: 0 }
      acc.rev += row.revenueCents
      acc.cost += row.costCents
      byProject.set(row.projectId, acc)
    }
    const keep = new Set<string>()
    for (const [pid, { rev, cost }] of byProject) {
      const m = marginPct(rev, cost)
      if (m !== null && matchesBucket(m, f.marginBucket)) keep.add(pid)
    }
    facts = facts.filter((row) => keep.has(row.projectId))
  }

  return facts
}

// ─── Resultado completo ──────────────────────────────────────────────────────────

export type InsightsKpis = {
  hours: number
  revenueCents: number
  costCents: number
  marginPct: number | null
  activeProjects: number
  people: number
}
export type RankItem = { id: string; label: string; value: number; secondary?: string }
export type DonutSlice = { key: string; label: string; value: number }
export type TimePoint = {
  month: string
  revenueCents: number
  costCents: number
  marginPct: number | null
  hours: number
}
export type HeatCell = { area: string; category: string; marginPct: number | null; revenueCents: number }

/** F3.5 Ola 2 — bloque de comparación temporal (periodo anterior o año anterior). */
export type InsightsCompare = {
  mode: 'prev' | 'yoy'
  kpis: InsightsKpis
  timeline: TimePoint[]
}

export type InsightsResult = {
  kpis: InsightsKpis
  topClients: RankItem[]
  topPeople: RankItem[]
  topProjects: RankItem[]
  areaMix: DonutSlice[]
  categoryMix: DonutSlice[]
  timeline: TimePoint[]
  heatmap: HeatCell[]
  compare: InsightsCompare | null
  rowCount: number
}

// ─── Cálculos reutilizables (periodo principal y de comparación) ──────────────────

function computeKpis(facts: FactRow[]): InsightsKpis {
  let hours = 0
  let revenueCents = 0
  let costCents = 0
  const activeProjects = new Set<string>()
  const people = new Set<string>()
  for (const r of facts) {
    hours += r.hours
    revenueCents += r.revenueCents
    costCents += r.costCents
    people.add(r.personId)
    if (r.projectStatus === 'active') activeProjects.add(r.projectId)
  }
  return {
    hours,
    revenueCents,
    costCents,
    marginPct: marginPct(revenueCents, costCents),
    activeProjects: activeProjects.size,
    people: people.size,
  }
}

function computeTimeline(facts: FactRow[]): TimePoint[] {
  const monthAgg = new Map<string, { rev: number; cost: number; hours: number }>()
  for (const r of facts) {
    const mm = monthAgg.get(r.month) ?? { rev: 0, cost: 0, hours: 0 }
    mm.rev += r.revenueCents
    mm.cost += r.costCents
    mm.hours += r.hours
    monthAgg.set(r.month, mm)
  }
  return [...monthAgg.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, v]) => ({
      month,
      revenueCents: v.rev,
      costCents: v.cost,
      marginPct: marginPct(v.rev, v.cost),
      hours: v.hours,
    }))
}

export async function getInsights(orgId: string, f: InsightsFilters): Promise<InsightsResult> {
  const facts = await fetchFactRows(orgId, f)

  // KPIs
  const kpis = computeKpis(facts)

  // Comparación temporal (periodo anterior / año anterior)
  let compare: InsightsCompare | null = null
  const compareRange = resolveCompareRange(f)
  if (compareRange && f.compare !== 'none') {
    const compareFacts = await fetchFactRows(orgId, f, compareRange)
    compare = {
      mode: f.compare,
      kpis: computeKpis(compareFacts),
      timeline: computeTimeline(compareFacts),
    }
  }

  // Rankings
  const clientAgg = new Map<string, { label: string; rev: number }>()
  const personAgg = new Map<string, { label: string; hours: number }>()
  const projectAgg = new Map<string, { label: string; rev: number; cost: number }>()
  for (const r of facts) {
    const cKey = r.clientId ?? '∅'
    const c = clientAgg.get(cKey) ?? { label: r.clientName ?? 'Sin cliente', rev: 0 }
    c.rev += r.revenueCents
    clientAgg.set(cKey, c)

    const pe = personAgg.get(r.personId) ?? { label: r.personName, hours: 0 }
    pe.hours += r.hours
    personAgg.set(r.personId, pe)

    const pr = projectAgg.get(r.projectId) ?? { label: r.projectName, rev: 0, cost: 0 }
    pr.rev += r.revenueCents
    pr.cost += r.costCents
    projectAgg.set(r.projectId, pr)
  }

  const topClients: RankItem[] = [...clientAgg.entries()]
    .map(([id, v]) => ({ id, label: v.label, value: v.rev }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const topPeople: RankItem[] = [...personAgg.entries()]
    .map(([id, v]) => ({ id, label: v.label, value: v.hours }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const topProjects: RankItem[] = [...projectAgg.entries()]
    .map(([id, v]) => {
      const m = marginPct(v.rev, v.cost)
      return { id, label: v.label, value: m ?? -999, secondary: m === null ? '—' : `${m.toFixed(1)}%` }
    })
    .filter((x) => x.value > -999)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Donuts (mix por horas)
  const areaAgg = new Map<string, number>()
  const catAgg = new Map<string, number>()
  for (const r of facts) {
    areaAgg.set(r.area, (areaAgg.get(r.area) ?? 0) + r.hours)
    catAgg.set(r.category, (catAgg.get(r.category) ?? 0) + r.hours)
  }
  const areaMix: DonutSlice[] = [...areaAgg.entries()]
    .map(([key, value]) => ({ key, label: AREA_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value)
  const categoryMix: DonutSlice[] = INSIGHTS_CATEGORIES.filter((c) => catAgg.has(c)).map((c) => ({
    key: c,
    label: CATEGORY_LABELS[c] ?? c,
    value: catAgg.get(c) ?? 0,
  }))

  // Timeline (mes a mes)
  const timeline = computeTimeline(facts)

  // Heatmap área × categoría (margen por celda)
  const cellAgg = new Map<string, { rev: number; cost: number }>()
  for (const r of facts) {
    const key = `${r.area}|${r.category}`
    const cell = cellAgg.get(key) ?? { rev: 0, cost: 0 }
    cell.rev += r.revenueCents
    cell.cost += r.costCents
    cellAgg.set(key, cell)
  }
  const heatmap: HeatCell[] = []
  for (const area of INSIGHTS_AREAS) {
    for (const category of INSIGHTS_CATEGORIES) {
      const cell = cellAgg.get(`${area}|${category}`)
      if (!cell) continue
      heatmap.push({ area, category, marginPct: marginPct(cell.rev, cell.cost), revenueCents: cell.rev })
    }
  }

  return {
    kpis,
    topClients,
    topPeople,
    topProjects,
    areaMix,
    categoryMix,
    timeline,
    heatmap,
    compare,
    rowCount: facts.length,
  }
}

// ─── Opciones para la barra de filtros ───────────────────────────────────────────

export type FilterOptions = {
  clients: Array<{ id: string; name: string }>
  workspaces: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string }>
  people: Array<{ id: string; name: string }>
}

export async function getInsightsFilterOptions(orgId: string): Promise<FilterOptions> {
  const res = await db.execute(sql`
    select 'client' as kind, id::text as id, name from clients where organization_id = ${orgId}
    union all
    select 'workspace', id::text, name from workspaces where organization_id = ${orgId}
    union all
    select 'project', id::text, name from projects where organization_id = ${orgId}
    union all
    select 'person', id::text, name from persons where organization_id = ${orgId}
    order by kind, name
  `)
  const rows = ((res as { rows?: unknown[] }).rows ?? (res as unknown as unknown[])) as Array<
    Record<string, unknown>
  >
  const out: FilterOptions = { clients: [], workspaces: [], projects: [], people: [] }
  for (const r of rows) {
    const item = { id: String(r.id), name: String(r.name ?? '—') }
    if (r.kind === 'client') out.clients.push(item)
    else if (r.kind === 'workspace') out.workspaces.push(item)
    else if (r.kind === 'project') out.projects.push(item)
    else if (r.kind === 'person') out.people.push(item)
  }
  return out
}
