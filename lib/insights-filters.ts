/**
 * F3.5 — Tipos, dominios y (de)serialización de filtros de Insights.
 *
 * Módulo PURO (sin import de `db`) para poder usarse tanto en el server (page +
 * capa de datos) como en client components (la barra de filtros).
 */

// ─── Dominios (allow-lists, también usados para validar input de la URL) ─────────

export const INSIGHTS_AREAS = ['research', 'ux', 'ui', 'cro'] as const
export const INSIGHTS_CATEGORIES = ['trainee', 'junior', 'mid', 'senior', 'lead', 'head'] as const
export const INSIGHTS_STATUSES = ['draft', 'active', 'paused', 'closed'] as const

export const AREA_LABELS: Record<string, string> = {
  research: 'Research',
  ux: 'UX',
  ui: 'UI',
  cro: 'CRO',
}
export const CATEGORY_LABELS: Record<string, string> = {
  trainee: 'Trainee',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  head: 'Head',
}
export const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
}

export const PERIOD_PRESETS = ['this_month', 'this_quarter', 'this_year', 'last_12m', 'custom'] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]
export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  this_month: 'Este mes',
  this_quarter: 'Este trimestre',
  this_year: 'Este año',
  last_12m: 'Últimos 12 meses',
  custom: 'Personalizado',
}

export const MARGIN_BUCKETS = ['neg', '0-10', '10-20', '20-30', '30+'] as const
export type MarginBucket = (typeof MARGIN_BUCKETS)[number]
export const MARGIN_BUCKET_LABELS: Record<MarginBucket, string> = {
  neg: '< 0%',
  '0-10': '0–10%',
  '10-20': '10–20%',
  '20-30': '20–30%',
  '30+': '30%+',
}

// ─── Modo de comparación temporal (F3.5 Ola 2) ───────────────────────────────────
// 'prev' = periodo inmediatamente anterior de la misma longitud (LQ / PoP).
// 'yoy'  = mismo rango de meses desplazado un año atrás (LY / YoY).
export const COMPARE_MODES = ['none', 'prev', 'yoy'] as const
export type CompareMode = (typeof COMPARE_MODES)[number]
export const COMPARE_LABELS: Record<CompareMode, string> = {
  none: 'Sin comparación',
  prev: 'Periodo anterior',
  yoy: 'Año anterior',
}

// ─── Filtros ────────────────────────────────────────────────────────────────────

export type InsightsFilters = {
  period: PeriodPreset
  from: string // 'YYYY-MM' (solo si period === 'custom')
  to: string // 'YYYY-MM'
  clientIds: string[]
  workspaceIds: string[]
  projectIds: string[]
  personIds: string[]
  categories: string[]
  areas: string[]
  statuses: string[]
  marginBucket: MarginBucket | null
  compare: CompareMode
}

export const EMPTY_FILTERS: InsightsFilters = {
  period: 'this_year',
  from: '',
  to: '',
  clientIds: [],
  workspaceIds: [],
  projectIds: [],
  personIds: [],
  categories: [],
  areas: [],
  statuses: [],
  marginBucket: null,
  compare: 'none',
}

type RawSearchParams = Record<string, string | string[] | undefined>

function csv(v: string | string[] | undefined): string[] {
  if (!v) return []
  const raw = Array.isArray(v) ? v.join(',') : v
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function only(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseInsightsFilters(params: RawSearchParams): InsightsFilters {
  const period = (PERIOD_PRESETS as readonly string[]).includes(only(params.period))
    ? (only(params.period) as PeriodPreset)
    : 'this_year'
  const marginRaw = only(params.margin)
  const compareRaw = only(params.compare)
  return {
    period,
    from: only(params.from),
    to: only(params.to),
    compare: (COMPARE_MODES as readonly string[]).includes(compareRaw) ? (compareRaw as CompareMode) : 'none',
    clientIds: csv(params.clients).filter((x) => UUID_RE.test(x)),
    workspaceIds: csv(params.accounts).filter((x) => UUID_RE.test(x)),
    projectIds: csv(params.projects).filter((x) => UUID_RE.test(x)),
    personIds: csv(params.people).filter((x) => UUID_RE.test(x)),
    categories: csv(params.categories).filter((x) => (INSIGHTS_CATEGORIES as readonly string[]).includes(x)),
    areas: csv(params.areas).filter((x) => (INSIGHTS_AREAS as readonly string[]).includes(x)),
    statuses: csv(params.statuses).filter((x) => (INSIGHTS_STATUSES as readonly string[]).includes(x)),
    marginBucket: (MARGIN_BUCKETS as readonly string[]).includes(marginRaw) ? (marginRaw as MarginBucket) : null,
  }
}

/** Construye el query string canónico para persistir filtros en la URL. */
export function buildInsightsQuery(f: InsightsFilters): string {
  const p = new URLSearchParams()
  if (f.period !== 'this_year') p.set('period', f.period)
  if (f.period === 'custom') {
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
  }
  if (f.clientIds.length) p.set('clients', f.clientIds.join(','))
  if (f.workspaceIds.length) p.set('accounts', f.workspaceIds.join(','))
  if (f.projectIds.length) p.set('projects', f.projectIds.join(','))
  if (f.personIds.length) p.set('people', f.personIds.join(','))
  if (f.categories.length) p.set('categories', f.categories.join(','))
  if (f.areas.length) p.set('areas', f.areas.join(','))
  if (f.statuses.length) p.set('statuses', f.statuses.join(','))
  if (f.marginBucket) p.set('margin', f.marginBucket)
  if (f.compare !== 'none') p.set('compare', f.compare)
  return p.toString()
}

export function countActiveFilters(f: InsightsFilters): number {
  return (
    f.clientIds.length +
    f.workspaceIds.length +
    f.projectIds.length +
    f.personIds.length +
    f.categories.length +
    f.areas.length +
    f.statuses.length +
    (f.marginBucket ? 1 : 0)
  )
}

// ─── Rango de meses ───────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
function firstOfMonth(ym: string): string {
  return `${ym}-01`
}
function ymOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
}

/** Devuelve [fromMonth, toMonth] como 'YYYY-MM-01' a partir del preset/custom. */
export function resolveMonthRange(f: InsightsFilters): { fromMonth: string; toMonth: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() // 0-based
  const thisMonth = `${y}-${pad2(m + 1)}`

  if (f.period === 'custom') {
    const from = /^\d{4}-\d{2}$/.test(f.from) ? f.from : thisMonth
    const to = /^\d{4}-\d{2}$/.test(f.to) ? f.to : thisMonth
    return from <= to
      ? { fromMonth: firstOfMonth(from), toMonth: firstOfMonth(to) }
      : { fromMonth: firstOfMonth(to), toMonth: firstOfMonth(from) }
  }
  if (f.period === 'this_month') {
    return { fromMonth: firstOfMonth(thisMonth), toMonth: firstOfMonth(thisMonth) }
  }
  if (f.period === 'this_quarter') {
    const qStartMonth = Math.floor(m / 3) * 3
    return { fromMonth: firstOfMonth(`${y}-${pad2(qStartMonth + 1)}`), toMonth: firstOfMonth(thisMonth) }
  }
  if (f.period === 'this_year') {
    return { fromMonth: firstOfMonth(`${y}-01`), toMonth: firstOfMonth(thisMonth) }
  }
  // last_12m
  const start = new Date(Date.UTC(y, m - 11, 1))
  return { fromMonth: firstOfMonth(ymOf(start)), toMonth: firstOfMonth(thisMonth) }
}

// ─── Rango de comparación (F3.5 Ola 2) ───────────────────────────────────────────

/** Índice absoluto de mes (año*12 + mes-1) a partir de 'YYYY-MM-01'. */
function monthIndex(firstOfMonthStr: string): number {
  const [y, m] = firstOfMonthStr.split('-').map(Number)
  return (y as number) * 12 + ((m as number) - 1)
}
function firstOfMonthFromIndex(idx: number): string {
  const y = Math.floor(idx / 12)
  const m = idx % 12
  return `${y}-${pad2(m + 1)}-01`
}

/**
 * Devuelve el rango de comparación [fromMonth, toMonth] como 'YYYY-MM-01', o null si
 * `compare === 'none'`. 'prev' = mismo nº de meses justo antes del rango actual;
 * 'yoy' = mismo rango desplazado 12 meses atrás.
 */
export function resolveCompareRange(f: InsightsFilters): { fromMonth: string; toMonth: string } | null {
  if (f.compare === 'none') return null
  const { fromMonth, toMonth } = resolveMonthRange(f)
  const fromIdx = monthIndex(fromMonth)
  const toIdx = monthIndex(toMonth)
  if (f.compare === 'yoy') {
    return { fromMonth: firstOfMonthFromIndex(fromIdx - 12), toMonth: firstOfMonthFromIndex(toIdx - 12) }
  }
  // prev: misma longitud, inmediatamente anterior
  const len = toIdx - fromIdx + 1
  return { fromMonth: firstOfMonthFromIndex(fromIdx - len), toMonth: firstOfMonthFromIndex(toIdx - len) }
}

export function matchesBucket(m: number, b: MarginBucket): boolean {
  switch (b) {
    case 'neg':
      return m < 0
    case '0-10':
      return m >= 0 && m < 10
    case '10-20':
      return m >= 10 && m < 20
    case '20-30':
      return m >= 20 && m < 30
    case '30+':
      return m >= 30
  }
}

export function marginPct(revenueCents: number, costCents: number): number | null {
  if (revenueCents <= 0) return null
  return ((revenueCents - costCents) / revenueCents) * 100
}
