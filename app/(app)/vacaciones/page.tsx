import { fetchSheetVacaciones } from '@/lib/sheets-vacaciones'
import { fetchVacationEvents } from '@/lib/vacation-calendar'
import type { VacationEvent } from '@/lib/vacation-calendar'
import { requireRole } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { holidayPresets } from '@/db/schema'
import { or, eq } from 'drizzle-orm'
import { VacacionesClient } from '@/components/vacaciones/vacaciones-client'
import type { OverlapWarning } from '@/components/vacaciones/vacaciones-client'
import type { PersonBalance } from '@/lib/sheets-vacaciones'

export const revalidate = 3600

// ─── Lead conflict config ─────────────────────────────────────────────────────

const LEADS_UX = new Set(['Ion', 'Carla'])
const LEADS_UI = new Set(['Dani Peña', 'Guille'])

// ─── Overlap computation ──────────────────────────────────────────────────────

function addDaysStr(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().split('T')[0]!
}

function computeOverlaps(people: PersonBalance[], today: string): OverlapWarning[] {
  const windowEnd = addDaysStr(today, 60)
  const warnings: OverlapWarning[] = []

  // Regla 1: dos leads del mismo departamento
  const checkLeadConflicts = (leads: Set<string>, dept: string) => {
    const leadPeople = people.filter((p) => leads.has(p.name) && !p.isBaja && !p.isExcedencia)
    if (leadPeople.length < 2) return
    for (let i = 0; i < leadPeople.length; i++) {
      for (let j = i + 1; j < leadPeople.length; j++) {
        const a = leadPeople[i]!
        const b = leadPeople[j]!
        for (const va of a.vacations) {
          if (va.status === 'bloqueado' || va.end < today || va.start > windowEnd) continue
          for (const vb of b.vacations) {
            if (vb.status === 'bloqueado' || vb.end < today || vb.start > windowEnd) continue
            const start = va.start > vb.start ? va.start : vb.start
            const end   = va.end < vb.end ? va.end : vb.end
            if (start <= end) warnings.push({ start, end, names: [a.name, b.name], reason: `⚠️ Dos leads ${dept} coinciden` })
          }
        }
      }
    }
  }

  checkLeadConflicts(LEADS_UX, 'UX')
  checkLeadConflicts(LEADS_UI, 'UI')

  // Regla 2: baja paternal de lead
  const allLeads = [...LEADS_UX, ...LEADS_UI]
  for (const p of people) {
    if (!allLeads.includes(p.name)) continue
    for (const v of p.vacations) {
      if (v.status !== 'baja_paternal') continue
      if (v.end < today || v.start > windowEnd) continue
      warnings.push({
        start: v.start > today ? v.start : today,
        end:   v.end < windowEnd ? v.end : windowEnd,
        names: [p.name],
        reason: '🍼 Baja paternal — lead fuera',
      })
    }
  }

  // Regla 3: coincidencia general (>1 persona mismo día)
  const dayMap = new Map<string, string[]>()
  for (const p of people) {
    if (p.isBaja || p.isExcedencia || p.isCro) continue
    for (const v of p.vacations) {
      if (v.status === 'bloqueado') continue
      if (v.end < today || v.start > windowEnd) continue
      let d = v.start < today ? today : v.start
      const to = v.end > windowEnd ? windowEnd : v.end
      while (d <= to) {
        const list = dayMap.get(d) ?? []
        list.push(p.name)
        dayMap.set(d, list)
        d = addDaysStr(d, 1)
      }
    }
  }

  const overlapDays = [...dayMap.entries()].filter(([, n]) => n.length > 1).sort(([a], [b]) => a.localeCompare(b))
  if (overlapDays.length > 0) {
    let cur = { start: overlapDays[0]![0], end: overlapDays[0]![0], names: overlapDays[0]![1] }
    for (let i = 1; i < overlapDays.length; i++) {
      const [day, names] = overlapDays[i]!
      const same = names.length === cur.names.length && names.every((n) => cur.names.includes(n))
      if (addDaysStr(cur.end, 1) === day && same) { cur.end = day }
      else { warnings.push({ ...cur, reason: 'Coincidencia' }); cur = { start: day, end: day, names } }
    }
    warnings.push({ ...cur, reason: 'Coincidencia' })
  }

  return warnings.sort((a, b) => a.start.localeCompare(b.start))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VacacionesPage() {
  const today = new Date().toISOString().split('T')[0]!
  const year  = new Date().getFullYear()

  const person    = await requireRole('contributor').catch(() => null)
  const isManager = person?.appRole === 'manager' || person?.appRole === 'admin'

  const [sheetPeople, holidayRows, calEvents] = await Promise.all([
    fetchSheetVacaciones(year),
    db.select({ region: holidayPresets.region, dates: holidayPresets.dates })
      .from(holidayPresets)
      .where(or(eq(holidayPresets.year, year), eq(holidayPresets.year, year + 1))),
    fetchVacationEvents(),
  ])

  const windowStart = new Date(new Date(today).setDate(new Date(today).getDate() - 14)).toISOString().split('T')[0]!
  const windowEnd   = new Date(new Date(today).setDate(new Date(today).getDate() + 90)).toISOString().split('T')[0]!
  const visibleEvents = calEvents
    .filter((e) => e.end >= windowStart && e.start <= windowEnd)
    .sort((a, b) => a.start.localeCompare(b.start))

  // Baja y excedencia solo visibles a manager/admin
  const visiblePeople = isManager
    ? sheetPeople
    : sheetPeople.filter((p) => !p.isBaja && !p.isExcedencia)

  const productPeople = visiblePeople.filter((p) => !p.isCro)
  const croPeople     = visiblePeople.filter((p) => p.isCro)
  const overlaps      = computeOverlaps(productPeople, today)

  // date → regions[]
  const holidays: Record<string, string[]> = {}
  for (const row of holidayRows) {
    for (const { date } of row.dates) {
      holidays[date] = [...(holidays[date] ?? []), row.region]
    }
  }

  const personRegions: Record<string, string> = {
    'Jordi':    'ES-CT',
    'Bego':     'ES-IB',
    'Fernando': 'ES-CL',
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? ''
  const sheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    : '#'

  return (
    <VacacionesClient
      productPeople={productPeople}
      croPeople={croPeople}
      overlaps={overlaps}
      holidays={holidays}
      personRegions={personRegions}
      today={today}
      year={year}
      sheetUrl={sheetUrl}
      calEvents={visibleEvents}
    />
  )
}
