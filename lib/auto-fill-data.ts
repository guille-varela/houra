/**
 * F3.5 — Autorellenar horas: capa de datos (server-only).
 *
 * Orquesta el cálculo puro de `lib/auto-fill.ts` sobre datos reales: construye el
 * calendario laborable por persona (festivos de su región + vacaciones), carga las
 * imputaciones manuales del periodo, resuelve tarifas y agrega el resultado por
 * asignación. Lo usan tanto `previewAutoFill` (no escribe) como `commitAutoFill`.
 */
import { and, eq, gte, inArray, lte, ne } from 'drizzle-orm'
import { db } from './db'
import {
  holidayPresets,
  organizations,
  persons,
  projectAssignments,
  projects,
  rates,
  timeEntries,
  timeOffEntries,
} from '@/db/schema'
import { computeAutoFill, dailyHoursFromWeekly, type AutoFillMode } from './auto-fill'
import { listWorkingDays, DEFAULT_HOLIDAY_REGION } from './feasibility'

export type AutoFillScope = { projectId?: string; personId?: string }

export type AutoFillRowEntry = {
  date: string
  hours: number
  costRateCents: number
  soldRateCents: number
}

export type AutoFillRow = {
  assignmentId: string
  personId: string
  personName: string
  projectId: string
  projectName: string
  area: string
  mode: AutoFillMode
  targetHours: number
  manualHours: number
  filledHours: number
  revenueCents: number
  costCents: number
  entries: AutoFillRowEntry[]
  warnings: string[]
  error: string | null
}

export type AutoFillScopeResult = {
  rows: AutoFillRow[]
  totals: {
    assignments: number
    entries: number
    hours: number
    revenueCents: number
    costCents: number
    withErrors: number
  }
}

function regionOf(holidayRegion: string | null): string {
  return holidayRegion && holidayRegion.trim() ? holidayRegion : DEFAULT_HOLIDAY_REGION
}

function yearsBetween(startIso: string, endIso: string): number[] {
  const y0 = Number(startIso.slice(0, 4))
  const y1 = Number(endIso.slice(0, 4))
  const out: number[] = []
  for (let y = y0; y <= y1; y++) out.push(y)
  return out
}

type EligibleRow = {
  assignmentId: string
  personId: string
  personName: string
  personPrimaryArea: string
  professionalCategory: string
  holidayRegion: string | null
  deactivatedAt: Date | null
  projectId: string
  projectName: string
  projectWeeklyHours: string
  projectWorkspaceId: string | null
  allowedAreas: string[]
  autoFillMode: AutoFillMode | null
  dedicationPercent: string | null
  monthlyTargetHours: string | null
  autoFillArea: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
}

async function getEligibleAssignments(orgId: string, scope: AutoFillScope): Promise<EligibleRow[]> {
  const conds = [
    eq(projectAssignments.organizationId, orgId),
    eq(projectAssignments.autoFillEnabled, true),
    eq(projectAssignments.isActive, true),
    // Solo proyectos que aceptan imputaciones (no draft/closed).
    inArray(projects.status, ['active', 'paused']),
  ]
  if (scope.projectId) conds.push(eq(projectAssignments.projectId, scope.projectId))
  if (scope.personId) conds.push(eq(projectAssignments.personId, scope.personId))

  const rows = await db
    .select({
      assignmentId: projectAssignments.id,
      personId: projectAssignments.personId,
      personName: persons.name,
      personPrimaryArea: persons.primaryArea,
      professionalCategory: persons.professionalCategory,
      holidayRegion: persons.holidayRegion,
      deactivatedAt: persons.deactivatedAt,
      projectId: projectAssignments.projectId,
      projectName: projects.name,
      projectWeeklyHours: projects.weeklyHours,
      projectWorkspaceId: projects.workspaceId,
      allowedAreas: projectAssignments.allowedAreas,
      autoFillMode: projectAssignments.autoFillMode,
      dedicationPercent: projectAssignments.dedicationPercent,
      monthlyTargetHours: projectAssignments.monthlyTargetHours,
      autoFillArea: projectAssignments.autoFillArea,
      effectiveFrom: projectAssignments.effectiveFrom,
      effectiveTo: projectAssignments.effectiveTo,
    })
    .from(projectAssignments)
    .innerJoin(persons, eq(persons.id, projectAssignments.personId))
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(and(...conds))

  return rows as EligibleRow[]
}

/** Mayor de dos fechas ISO 'YYYY-MM-DD' (string compare es válido en ISO). */
function maxIso(a: string, b: string): string {
  return a >= b ? a : b
}
function minIso(a: string, b: string): string {
  return a <= b ? a : b
}

/** Calcula el autorelleno propuesto para todas las asignaciones elegibles del scope. */
export async function computeAutoFillForScope(
  orgId: string,
  period: { periodStart: string; periodEnd: string },
  scope: AutoFillScope,
): Promise<AutoFillScopeResult> {
  const { periodStart, periodEnd } = period

  const [eligible, orgRow] = await Promise.all([
    getEligibleAssignments(orgId, scope),
    db
      .select({ defaultWeeklyHours: organizations.defaultWeeklyHours })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1),
  ])
  const orgWeekly = orgRow[0]?.defaultWeeklyHours ? parseFloat(orgRow[0].defaultWeeklyHours) : 37.5

  if (eligible.length === 0) {
    return { rows: [], totals: { assignments: 0, entries: 0, hours: 0, revenueCents: 0, costCents: 0, withErrors: 0 } }
  }

  // ── Carga EN LOTE de todos los datos auxiliares (pocas queries fijas, no por
  //    asignación → respeta el límite de subrequests del Worker). ──────────────────
  const personIds = [...new Set(eligible.map((a) => a.personId))]
  const projectIds = [...new Set(eligible.map((a) => a.projectId))]
  const regions = [...new Set(eligible.map((a) => regionOf(a.holidayRegion)))]
  const years = yearsBetween(periodStart, periodEnd)

  const [holidayRows, timeOffRows, manualRows, rateRows] = await Promise.all([
    db
      .select({ region: holidayPresets.region, dates: holidayPresets.dates })
      .from(holidayPresets)
      .where(and(inArray(holidayPresets.region, regions), inArray(holidayPresets.year, years))),
    db
      .select({ personId: timeOffEntries.personId, date: timeOffEntries.date })
      .from(timeOffEntries)
      .where(
        and(
          eq(timeOffEntries.organizationId, orgId),
          inArray(timeOffEntries.personId, personIds),
          gte(timeOffEntries.date, periodStart),
          lte(timeOffEntries.date, periodEnd),
        ),
      ),
    db
      .select({
        personId: timeEntries.personId,
        projectId: timeEntries.projectId,
        date: timeEntries.date,
        hours: timeEntries.hours,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.organizationId, orgId),
          inArray(timeEntries.personId, personIds),
          inArray(timeEntries.projectId, projectIds),
          eq(timeEntries.source, 'manual'),
          gte(timeEntries.date, periodStart),
          lte(timeEntries.date, periodEnd),
        ),
      ),
    db.select().from(rates).where(eq(rates.organizationId, orgId)),
  ])

  // Festivos por región.
  const holidaysByRegion = new Map<string, Set<string>>()
  for (const r of holidayRows) {
    const set = holidaysByRegion.get(r.region) ?? new Set<string>()
    for (const d of r.dates as Array<{ date: string }>) set.add(d.date)
    holidaysByRegion.set(r.region, set)
  }
  // Vacaciones por persona.
  const vacationsByPerson = new Map<string, Set<string>>()
  for (const r of timeOffRows) {
    const set = vacationsByPerson.get(r.personId) ?? new Set<string>()
    set.add(r.date as string)
    vacationsByPerson.set(r.personId, set)
  }
  // Manuales por (persona|proyecto) → horas por fecha.
  const manualByPair = new Map<string, Record<string, number>>()
  for (const m of manualRows) {
    const key = `${m.personId}|${m.projectId}`
    const rec = manualByPair.get(key) ?? {}
    rec[m.date as string] = (rec[m.date as string] ?? 0) + parseFloat(m.hours)
    manualByPair.set(key, rec)
  }

  // Resolución de tarifa EN MEMORIA (misma cascada que lib/rates.ts).
  function resolveRateMem(
    personId: string,
    projectId: string,
    workspaceId: string | null,
    area: string,
    role: string,
    date: string,
  ): { costRateCents: number; soldRateCents: number } | null {
    const cands = rateRows.filter(
      (r) =>
        r.area === area &&
        r.role === role &&
        r.effectiveFrom <= date &&
        (r.effectiveTo === null || r.effectiveTo >= date),
    )
    const personRow = cands.find((r) => r.personId === personId)
    const projectRow = cands.find((r) => r.projectId === projectId && r.personId === null)
    const workspaceRow = cands.find(
      (r) => r.workspaceId === workspaceId && r.projectId === null && r.personId === null,
    )
    const orgScopeRow = cands.find((r) => r.workspaceId === null && r.projectId === null && r.personId === null)
    const costRateCents =
      personRow?.costRateCents ?? projectRow?.costRateCents ?? workspaceRow?.costRateCents ?? orgScopeRow?.costRateCents ?? null
    const soldRateCents =
      projectRow?.soldRateCents ?? workspaceRow?.soldRateCents ?? orgScopeRow?.soldRateCents ?? null
    if (costRateCents === null || soldRateCents === null) return null
    return { costRateCents, soldRateCents }
  }

  // Todo lo necesario está ya en memoria → el cálculo por asignación es síncrono
  // (cero queries dentro del bucle → no agota el límite de subrequests del Worker).
  const rows: AutoFillRow[] = eligible.map((a): AutoFillRow => {
    const area = a.autoFillArea ?? a.personPrimaryArea
    const baseRow = {
      assignmentId: a.assignmentId,
      personId: a.personId,
      personName: a.personName,
      projectId: a.projectId,
      projectName: a.projectName,
      area,
      mode: (a.autoFillMode ?? 'percent') as AutoFillMode,
    }

    // Validaciones que descartan la asignación con un error legible.
    if (!a.autoFillMode) {
      return { ...baseRow, targetHours: 0, manualHours: 0, filledHours: 0, revenueCents: 0, costCents: 0, entries: [], warnings: [], error: 'Sin modo de dedicación configurado.' }
    }
    if (a.autoFillArea && !a.allowedAreas.includes(a.autoFillArea)) {
      return { ...baseRow, targetHours: 0, manualHours: 0, filledHours: 0, revenueCents: 0, costCents: 0, entries: [], warnings: [], error: `El área "${a.autoFillArea}" no está permitida en esta asignación.` }
    }

    // Ventana efectiva del periodo (altas/bajas, cambios de %).
    let effStart = periodStart
    let effEnd = periodEnd
    if (a.effectiveFrom) effStart = maxIso(effStart, a.effectiveFrom)
    if (a.effectiveTo) effEnd = minIso(effEnd, a.effectiveTo)
    if (a.deactivatedAt) {
      const deIso = a.deactivatedAt.toISOString().slice(0, 10)
      effEnd = minIso(effEnd, deIso)
    }
    if (effStart > effEnd) {
      return { ...baseRow, targetHours: 0, manualHours: 0, filledHours: 0, revenueCents: 0, costCents: 0, entries: [], warnings: ['La asignación no está vigente en el periodo seleccionado.'], error: null }
    }

    const holidaySet = new Set<string>([
      ...(holidaysByRegion.get(regionOf(a.holidayRegion)) ?? []),
      ...(vacationsByPerson.get(a.personId) ?? []),
    ])
    const manualHoursByDate = manualByPair.get(`${a.personId}|${a.projectId}`) ?? {}

    const weekly = a.projectWeeklyHours ? parseFloat(a.projectWeeklyHours) : orgWeekly
    const dailyHours = dailyHoursFromWeekly(weekly)

    // Pro-rata en modo monthly_hours: días laborables del periodo COMPLETO solicitado.
    const fullPeriodWorkingDays =
      a.autoFillMode === 'monthly_hours'
        ? listWorkingDays(periodStart, periodEnd, holidaySet).length
        : null

    const result = computeAutoFill({
      periodStart: effStart,
      periodEnd: effEnd,
      holidaySet,
      mode: a.autoFillMode,
      dailyHours,
      dedicationPercent: a.dedicationPercent ? parseFloat(a.dedicationPercent) : null,
      monthlyTargetHours: a.monthlyTargetHours ? parseFloat(a.monthlyTargetHours) : null,
      fullPeriodWorkingDays,
      manualHoursByDate,
    })

    // Tarifa: resuelta EN MEMORIA (cascada person>project>workspace>org).
    let costRateCents = 0
    let soldRateCents = 0
    let error: string | null = null
    if (result.entries.length > 0) {
      const r = resolveRateMem(a.personId, a.projectId, a.projectWorkspaceId, area, a.professionalCategory, effStart)
      if (r) {
        costRateCents = r.costRateCents
        soldRateCents = r.soldRateCents
      } else {
        error = `No hay tarifa configurada para el área ${area} y rol ${a.professionalCategory}.`
      }
    }

    const entries: AutoFillRowEntry[] = error
      ? []
      : result.entries.map((e) => ({ date: e.date, hours: e.hours, costRateCents, soldRateCents }))
    const revenueCents = entries.reduce((s, e) => s + Math.round(e.hours * e.soldRateCents), 0)
    const costCents = entries.reduce((s, e) => s + Math.round(e.hours * e.costRateCents), 0)

    return {
      ...baseRow,
      targetHours: result.targetHours,
      manualHours: result.manualHours,
      filledHours: error ? 0 : result.filledHours,
      revenueCents,
      costCents,
      entries,
      warnings: result.warnings,
      error,
    }
  })

  const totals = rows.reduce(
    (t, r) => ({
      assignments: t.assignments + 1,
      entries: t.entries + r.entries.length,
      hours: Math.round((t.hours + r.filledHours) * 100) / 100,
      revenueCents: t.revenueCents + r.revenueCents,
      costCents: t.costCents + r.costCents,
      withErrors: t.withErrors + (r.error ? 1 : 0),
    }),
    { assignments: 0, entries: 0, hours: 0, revenueCents: 0, costCents: 0, withErrors: 0 },
  )

  return { rows, totals }
}

// ─── Configuración de dedicación por asignación ───────────────────────────────────

export type ConfigurableAssignment = {
  assignmentId: string
  personName: string
  projectId: string
  projectName: string
  projectType: string
  billingModel: string
  allowedAreas: string[]
  autoFillEnabled: boolean
  autoFillMode: AutoFillMode | null
  dedicationPercent: string | null
  monthlyTargetHours: string | null
  autoFillArea: string | null
}

/** Asignaciones activas de la org (para configurar su dedicación en el panel). */
export async function getConfigurableAssignments(orgId: string): Promise<ConfigurableAssignment[]> {
  const rows = await db
    .select({
      assignmentId: projectAssignments.id,
      personName: persons.name,
      projectId: projectAssignments.projectId,
      projectName: projects.name,
      projectType: projects.type,
      billingModel: projects.billingModel,
      allowedAreas: projectAssignments.allowedAreas,
      autoFillEnabled: projectAssignments.autoFillEnabled,
      autoFillMode: projectAssignments.autoFillMode,
      dedicationPercent: projectAssignments.dedicationPercent,
      monthlyTargetHours: projectAssignments.monthlyTargetHours,
      autoFillArea: projectAssignments.autoFillArea,
    })
    .from(projectAssignments)
    .innerJoin(persons, eq(persons.id, projectAssignments.personId))
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(
      and(
        eq(projectAssignments.organizationId, orgId),
        eq(projectAssignments.isActive, true),
        ne(projects.status, 'closed'),
      ),
    )

  return rows as ConfigurableAssignment[]
}
