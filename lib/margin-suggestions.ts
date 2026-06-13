import { ROLES, ROLE_LABELS, AREA_LABELS, type Role, type Area } from './matrix'

/** Línea de equipo con sus tarifas resueltas (en céntimos) */
export type SuggestionLine = {
  id: string
  area: string
  role: string
  hours: number
  costRateCents: number | null
  soldRateCents: number | null
}

export type MarginSuggestion = {
  lineId: string
  kind: 'reduce_hours' | 'substitute_role'
  description: string
  ppGain: number
  /** Cambios a aplicar sobre la línea de staffing */
  patch: { estimatedHours?: number; roleCategory?: string; staffingType?: 'role' }
}

type Totals = { revCents: number; costCents: number; marginPct: number | null }

function totalsOf(lines: SuggestionLine[]): Totals {
  let revCents = 0
  let costCents = 0
  for (const l of lines) {
    revCents += l.hours * (l.soldRateCents ?? 0)
    costCents += l.hours * (l.costRateCents ?? 0)
  }
  const marginPct = revCents > 0 ? ((revCents - costCents) / revCents) * 100 : null
  return { revCents, costCents, marginPct }
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role
}

function areaLabel(area: string): string {
  return AREA_LABELS[area as Area] ?? area.toUpperCase()
}

/**
 * F2.11 — Motor de sugerencias para acercar el margen al objetivo.
 * Genera hipótesis a nivel de propuesta (reducir horas, sustituir por categoría
 * más barata). No propone cambios de tarifa de organización (afectan a todos los
 * proyectos). Solo devuelve sugerencias si el déficit es > 1pp.
 */
export function computeMarginSuggestions(
  lines: SuggestionLine[],
  targetPct: number | null,
  rateFor: (area: string, role: string) => { costRateCents: number | null; soldRateCents: number | null },
): MarginSuggestion[] {
  const base = totalsOf(lines)
  if (targetPct == null || base.marginPct == null) return []
  const gap = targetPct - base.marginPct
  if (gap <= 1) return []

  const baseMargin = base.marginPct
  const suggestions: MarginSuggestion[] = []

  for (const line of lines) {
    if (line.hours <= 0) continue

    // ── Reducir horas de un perfil que arrastra el margen ──
    const delta = Math.min(line.hours, Math.max(5, Math.round(line.hours / 4)))
    if (delta > 0 && delta < line.hours) {
      const after = totalsOf(
        lines.map((l) => (l.id === line.id ? { ...l, hours: l.hours - delta } : l)),
      )
      const ppGain = after.marginPct != null ? after.marginPct - baseMargin : 0
      if (ppGain > 0.1) {
        suggestions.push({
          lineId: line.id,
          kind: 'reduce_hours',
          description: `Reducir ${delta}h del perfil ${roleLabel(line.role)} · ${areaLabel(line.area)}`,
          ppGain,
          patch: { estimatedHours: line.hours - delta },
        })
      }
    }

    // ── Sustituir por la categoría más barata que mejore el margen ──
    const idx = ROLES.indexOf(line.role as Role)
    let bestSub: MarginSuggestion | null = null
    for (let i = idx - 1; i >= 0; i--) {
      const cheaperRole = ROLES[i]!
      const rate = rateFor(line.area, cheaperRole)
      if (rate.costRateCents == null) continue
      const after = totalsOf(
        lines.map((l) =>
          l.id === line.id
            ? { ...l, role: cheaperRole, costRateCents: rate.costRateCents, soldRateCents: rate.soldRateCents }
            : l,
        ),
      )
      const ppGain = after.marginPct != null ? after.marginPct - baseMargin : 0
      if (ppGain > 0.1 && (!bestSub || ppGain > bestSub.ppGain)) {
        bestSub = {
          lineId: line.id,
          kind: 'substitute_role',
          description: `Sustituir ${roleLabel(line.role)} por ${roleLabel(cheaperRole)} en ${areaLabel(line.area)}`,
          ppGain,
          patch: { roleCategory: cheaperRole, staffingType: 'role' },
        }
      }
    }
    if (bestSub) suggestions.push(bestSub)
  }

  // Mejor sugerencia por línea, ordenadas por impacto, máximo 4
  const bestPerLine = new Map<string, MarginSuggestion>()
  for (const s of suggestions.sort((a, b) => b.ppGain - a.ppGain)) {
    const key = `${s.lineId}:${s.kind}`
    if (!bestPerLine.has(key)) bestPerLine.set(key, s)
  }
  return [...bestPerLine.values()].sort((a, b) => b.ppGain - a.ppGain).slice(0, 4)
}
