import { AREAS, ROLES, type Allocation } from './matrix'

export type MarginCell = {
  area: string
  role: string
  hours: number
  costCents: number
  soldCents: number
  marginCents: number
  marginPct: number | null  // null when soldCents = 0
}

// Merges original allocation with all amendments' delta_allocations
export function computeEffectiveAllocation(
  original: Allocation,
  amendments: Array<{ deltaAllocation: Record<string, Record<string, number>> }>,
): Allocation {
  const result: Allocation = {}
  for (const area of AREAS) {
    result[area] = {}
    for (const role of ROLES) {
      result[area]![role] = original[area]?.[role] ?? 0
    }
  }
  for (const amendment of amendments) {
    for (const [area, roles] of Object.entries(amendment.deltaAllocation)) {
      if (!result[area]) result[area] = {}
      for (const [role, delta] of Object.entries(roles)) {
        result[area]![role] = (result[area]![role] ?? 0) + delta
      }
    }
  }
  return result
}

export function buildMarginMatrix(
  rows: Array<{ area: string; role: string; hours: number; costCents: number; soldCents: number }>,
): MarginCell[][] {
  return AREAS.map((area) =>
    ROLES.map((role) => {
      const row = rows.find((r) => r.area === area && r.role === role)
      if (!row || row.hours === 0) {
        return { area, role, hours: 0, costCents: 0, soldCents: 0, marginCents: 0, marginPct: null }
      }
      const marginCents = row.soldCents - row.costCents
      const marginPct = row.soldCents > 0 ? (marginCents / row.soldCents) * 100 : null
      return {
        area, role,
        hours: row.hours,
        costCents: row.costCents,
        soldCents: row.soldCents,
        marginCents,
        marginPct,
      }
    }),
  )
}

export function getMarginTotals(matrix: MarginCell[][]) {
  let hours = 0
  let costCents = 0
  let soldCents = 0
  for (const row of matrix) {
    for (const cell of row) {
      hours += cell.hours
      costCents += cell.costCents
      soldCents += cell.soldCents
    }
  }
  const marginCents = soldCents - costCents
  const marginPct = soldCents > 0 ? (marginCents / soldCents) * 100 : null
  return { hours, costCents, soldCents, marginCents, marginPct }
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
