export const AREAS = ['research', 'ux', 'ui'] as const
export const ROLES = ['trainee', 'junior', 'mid', 'senior', 'lead', 'head'] as const

export type Area = (typeof AREAS)[number]
export type Role = (typeof ROLES)[number]

export const AREA_LABELS: Record<Area, string> = {
  research: 'Research',
  ux: 'UX',
  ui: 'UI',
}

export const ROLE_LABELS: Record<Role, string> = {
  trainee: 'Trainee',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  head: 'Head',
}

export type Allocation = Record<string, Record<string, number>>

export type MatrixCell = {
  area: Area
  role: Role
  planned: number
  consumed: number
  pct: number | null
  color: 'green' | 'orange' | 'red' | 'empty'
}

export type ConsumedMap = Partial<Record<Area, Partial<Record<Role, number>>>>

export function buildMatrix(allocation: Allocation, consumed: ConsumedMap): MatrixCell[][] {
  return AREAS.map((area) =>
    ROLES.map((role) => {
      const planned = allocation[area]?.[role] ?? 0
      const cons = consumed[area]?.[role] ?? 0
      if (planned === 0 && cons === 0) {
        return { area, role, planned: 0, consumed: 0, pct: null, color: 'empty' as const }
      }
      if (planned === 0 && cons > 0) {
        // unplanned consumption — always red, no percentage
        return { area, role, planned: 0, consumed: cons, pct: null, color: 'red' as const }
      }
      const pct = (cons / planned) * 100
      const color =
        pct >= 100 ? ('red' as const) : pct >= 80 ? ('orange' as const) : ('green' as const)
      return { area, role, planned, consumed: cons, pct, color }
    }),
  )
}

export function getProjectTotals(matrix: MatrixCell[][]) {
  let planned = 0
  let consumed = 0
  for (const row of matrix) {
    for (const cell of row) {
      planned += cell.planned
      consumed += cell.consumed
    }
  }
  const pct = planned > 0 ? (consumed / planned) * 100 : null
  const color =
    pct === null ? 'empty' : pct >= 100 ? 'red' : pct >= 80 ? 'orange' : 'green'
  return { planned, consumed, pct, color }
}

export function getProjectedEndDate(
  totalPlanned: number,
  totalConsumed: number,
  startDate: string | null,
): string | null {
  if (!startDate || totalConsumed === 0 || totalPlanned <= 0) return null

  const start = new Date(startDate + 'T00:00:00')
  const today = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const weeksElapsed = Math.max(1, (today.getTime() - start.getTime()) / msPerWeek)
  const weeklyRate = totalConsumed / weeksElapsed
  if (weeklyRate <= 0) return null

  const remaining = totalPlanned - totalConsumed
  if (remaining <= 0) return null

  const weeksLeft = remaining / weeklyRate
  const projected = new Date(today.getTime() + weeksLeft * msPerWeek)
  return projected.toISOString().split('T')[0] as string
}
