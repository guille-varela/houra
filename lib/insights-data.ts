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
  type PivotDim,
  type PivotCol,
  type PivotMetric,
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

/** F3.5 Ola 3 — tabla pivote dinámica (ejes elegibles + métrica). */
export type PivotResult = {
  rowDim: PivotDim
  colDim: PivotCol
  metric: PivotMetric
  colHeaders: Array<{ key: string; label: string }>
  rows: Array<{ key: string; label: string; cells: Array<number | null>; total: number | null }>
  colTotals: Array<number | null>
  grandTotal: number | null
  truncatedRows: number // filas omitidas tras el tope (0 si ninguna)
  truncatedCols: number
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
  pivot: PivotResult
  rowCount: number
}

// ─── Pivot table (F3.5 Ola 3) ─────────────────────────────────────────────────────

const PIVOT_MAX_ROWS = 50
const PIVOT_MAX_COLS = 31

type Acc = { hours: number; rev: number; cost: number }

function emptyAcc(): Acc {
  return { hours: 0, rev: 0, cost: 0 }
}
function addInto(acc: Acc, r: FactRow): void {
  acc.hours += r.hours
  acc.rev += r.revenueCents
  acc.cost += r.costCents
}
function projectMetric(acc: Acc, metric: PivotMetric): number | null {
  switch (metric) {
    case 'hours':
      return acc.hours
    case 'revenue':
      return acc.rev
    case 'cost':
      return acc.cost
    case 'margin':
      return marginPct(acc.rev, acc.cost)
  }
}

function dimKeyLabel(r: FactRow, dim: PivotDim): { key: string; label: string } {
  switch (dim) {
    case 'client':
      return { key: r.clientId ?? '∅', label: r.clientName ?? 'Sin cliente' }
    case 'project':
      return { key: r.projectId, label: r.projectName }
    case 'person':
      return { key: r.personId, label: r.personName }
    case 'area':
      return { key: r.area, label: AREA_LABELS[r.area] ?? r.area }
    case 'category':
      return { key: r.category, label: CATEGORY_LABELS[r.category] ?? r.category }
    case 'month':
      return { key: r.month, label: r.month }
  }
}

/**
 * Ordena las claves de un eje. Las dimensiones con orden natural (mes, área,
 * categoría) usan ese orden; el resto se ordena por ingresos descendente para que
 * lo relevante quede arriba/izquierda independientemente de la métrica mostrada.
 */
function orderAxis(
  dim: PivotDim,
  entries: Array<{ key: string; label: string; rev: number }>,
): Array<{ key: string; label: string }> {
  let sorted: typeof entries
  if (dim === 'month') {
    sorted = [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  } else if (dim === 'area') {
    const order = INSIGHTS_AREAS as readonly string[]
    sorted = [...entries].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  } else if (dim === 'category') {
    const order = INSIGHTS_CATEGORIES as readonly string[]
    sorted = [...entries].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  } else {
    sorted = [...entries].sort((a, b) => b.rev - a.rev)
  }
  return sorted.map((e) => ({ key: e.key, label: e.label }))
}

export function computePivot(
  facts: FactRow[],
  config: { row: PivotDim; col: PivotCol; metric: PivotMetric },
): PivotResult {
  const { row: rowDim, metric } = config
  // Si fila y columna coinciden, la columna pierde sentido → tabla de una sola columna.
  const colDim: PivotCol = config.col === rowDim ? 'none' : config.col

  const rowMeta = new Map<string, { label: string; rev: number }>()
  const colMeta = new Map<string, { label: string; rev: number }>()
  const cellAcc = new Map<string, Acc>() // `${rowKey}|${colKey}`

  const COL_NONE = '∑'

  for (const r of facts) {
    const rk = dimKeyLabel(r, rowDim)
    const rm = rowMeta.get(rk.key) ?? { label: rk.label, rev: 0 }
    rm.rev += r.revenueCents
    rowMeta.set(rk.key, rm)

    let colKey = COL_NONE
    if (colDim !== 'none') {
      const ck = dimKeyLabel(r, colDim)
      colKey = ck.key
      const cm = colMeta.get(colKey) ?? { label: ck.label, rev: 0 }
      cm.rev += r.revenueCents
      colMeta.set(colKey, cm)
    }

    const cellKey = `${rk.key} ${colKey}`
    const acc = cellAcc.get(cellKey) ?? emptyAcc()
    addInto(acc, r)
    cellAcc.set(cellKey, acc)
  }

  // Ejes ordenados + tope.
  const rowEntries = [...rowMeta.entries()].map(([key, v]) => ({ key, label: v.label, rev: v.rev }))
  let orderedRows = orderAxis(rowDim, rowEntries)
  const truncatedRows = Math.max(0, orderedRows.length - PIVOT_MAX_ROWS)
  if (truncatedRows > 0) orderedRows = orderedRows.slice(0, PIVOT_MAX_ROWS)

  let colHeaders: Array<{ key: string; label: string }>
  let truncatedCols = 0
  if (colDim === 'none') {
    colHeaders = []
  } else {
    const colEntries = [...colMeta.entries()].map(([key, v]) => ({ key, label: v.label, rev: v.rev }))
    let ordered = orderAxis(colDim, colEntries)
    truncatedCols = Math.max(0, ordered.length - PIVOT_MAX_COLS)
    if (truncatedCols > 0) ordered = ordered.slice(0, PIVOT_MAX_COLS)
    colHeaders = ordered
  }

  // Acumuladores de totales por columna (incluido el caso 'none' → 1 columna virtual).
  const colTotalAcc = colDim === 'none' ? [emptyAcc()] : colHeaders.map(() => emptyAcc())
  const grandAcc = emptyAcc()

  const rows = orderedRows.map((rEntry) => {
    if (colDim === 'none') {
      const acc = cellAcc.get(`${rEntry.key} ${COL_NONE}`) ?? emptyAcc()
      mergeAcc(colTotalAcc[0] as Acc, acc)
      mergeAcc(grandAcc, acc)
      return { key: rEntry.key, label: rEntry.label, cells: [], total: projectMetric(acc, metric) }
    }
    const rowAcc = emptyAcc()
    const cells = colHeaders.map((cHeader, i) => {
      const acc = cellAcc.get(`${rEntry.key} ${cHeader.key}`) ?? emptyAcc()
      mergeAcc(rowAcc, acc)
      mergeAcc(colTotalAcc[i] as Acc, acc)
      mergeAcc(grandAcc, acc)
      return projectMetric(acc, metric)
    })
    return { key: rEntry.key, label: rEntry.label, cells, total: projectMetric(rowAcc, metric) }
  })

  const colTotals =
    colDim === 'none' ? [] : colTotalAcc.map((acc) => projectMetric(acc, metric))
  const grandTotal = projectMetric(grandAcc, metric)

  return {
    rowDim,
    colDim,
    metric,
    colHeaders,
    rows,
    colTotals,
    grandTotal,
    truncatedRows,
    truncatedCols,
  }
}

// Acumular un Acc dentro de otro.
function mergeAcc(into: Acc, from: Acc): void {
  into.hours += from.hours
  into.rev += from.rev
  into.cost += from.cost
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

  // Tabla pivote dinámica (reutiliza los facts ya filtrados).
  const pivot = computePivot(facts, {
    row: f.pivotRow,
    col: f.pivotCol,
    metric: f.pivotMetric,
  })

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
    pivot,
    rowCount: facts.length,
  }
}

// ─── Bolsa de horas de cartera (F3.5 Ola 2) ──────────────────────────────────────
//
// "Horas vendidas/restantes" es un concepto de VIDA DE PROYECTO, no de periodo: la
// bolsa total se pacta una vez (originalAllocation) y se ajusta con amendments. Por eso
// este bloque NO depende del periodo ni de la persona; solo respeta los filtros que son
// dimensiones reales de la bolsa: cuenta, cliente, proyecto, estado, área y categoría.
// Solo aplica a proyectos con bolsa (fixed_bag / renewable_bag); capacity/fee se excluyen.

export type BagSummary = {
  soldHours: number
  consumedHours: number
  remainingHours: number
  consumedPct: number | null
  projectCount: number
}

const BAG_PROJECT_TYPES = ['fixed_bag', 'renewable_bag'] as const

function sumAllocation(
  alloc: Record<string, Record<string, number>> | null | undefined,
  areas: Set<string> | null,
  cats: Set<string> | null,
): number {
  let total = 0
  if (!alloc || typeof alloc !== 'object') return total
  for (const [area, roles] of Object.entries(alloc)) {
    if (areas && !areas.has(area)) continue
    if (!roles || typeof roles !== 'object') continue
    for (const [role, h] of Object.entries(roles)) {
      if (cats && !cats.has(role)) continue
      total += Number(h) || 0
    }
  }
  return total
}

export async function getBagSummary(orgId: string, f: InsightsFilters): Promise<BagSummary | null> {
  const areasSet = f.areas.length ? new Set(f.areas) : null
  const catsSet = f.categories.length ? new Set(f.categories) : null

  // 1) Proyectos con bolsa dentro del scope de selección.
  const conds: SQL[] = [
    sql`organization_id = ${orgId}`,
    inText(sql`type::text`, [...BAG_PROJECT_TYPES]),
  ]
  if (f.statuses.length) conds.push(inText(sql`status::text`, f.statuses))
  else conds.push(sql`status::text <> 'draft'`)
  if (f.clientIds.length) conds.push(inUuid(sql`client_id`, f.clientIds))
  if (f.workspaceIds.length) conds.push(inUuid(sql`workspace_id`, f.workspaceIds))
  if (f.projectIds.length) conds.push(inUuid(sql`id`, f.projectIds))

  const projRes = await db.execute(sql`
    select id::text as id, original_allocation as alloc
    from projects
    where ${sql.join(conds, sql` and `)}
  `)
  const projRows = ((projRes as { rows?: unknown[] }).rows ?? (projRes as unknown as unknown[])) as Array<
    Record<string, unknown>
  >
  if (projRows.length === 0) return null

  const scopeIds = projRows.map((r) => String(r.id))

  // Horas vendidas = allocation original + amendments (respetando área/categoría).
  let soldHours = 0
  for (const r of projRows) {
    soldHours += sumAllocation(
      r.alloc as Record<string, Record<string, number>> | null,
      areasSet,
      catsSet,
    )
  }

  const amdRes = await db.execute(sql`
    select delta_allocation as delta
    from amendments
    where organization_id = ${orgId} and ${inUuid(sql`project_id`, scopeIds)}
  `)
  const amdRows = ((amdRes as { rows?: unknown[] }).rows ?? (amdRes as unknown as unknown[])) as Array<
    Record<string, unknown>
  >
  for (const r of amdRows) {
    soldHours += sumAllocation(
      r.delta as Record<string, Record<string, number>> | null,
      areasSet,
      catsSet,
    )
  }

  // 2) Horas consumidas (a vida de proyecto) sobre esos proyectos.
  const consConds: SQL[] = [
    sql`te.organization_id = ${orgId}`,
    inUuid(sql`te.project_id`, scopeIds),
  ]
  if (areasSet) consConds.push(inText(sql`te.area`, [...areasSet]))
  if (catsSet) consConds.push(inText(sql`p.professional_category::text`, [...catsSet]))

  const consRes = await db.execute(sql`
    select coalesce(sum(te.hours), 0)::float8 as consumed
    from time_entries te
    join persons p on p.id = te.person_id
    where ${sql.join(consConds, sql` and `)}
  `)
  const consRows = ((consRes as { rows?: unknown[] }).rows ?? (consRes as unknown as unknown[])) as Array<
    Record<string, unknown>
  >
  const consumedHours = Number(consRows[0]?.consumed ?? 0)

  return {
    soldHours,
    consumedHours,
    remainingHours: soldHours - consumedHours,
    consumedPct: soldHours > 0 ? (consumedHours / soldHours) * 100 : null,
    projectCount: scopeIds.length,
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
