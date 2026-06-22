/**
 * F3.5 — Autorellenar horas: núcleo de cálculo PURO (sin DB ni DOM).
 *
 * Dada una dedicación pactada (% de jornada o horas/mes) y el calendario laborable de
 * la persona (días laborables ya descontados festivos+vacaciones), reparte las horas
 * objetivo del periodo en entradas diarias, respetando lo ya imputado a mano.
 *
 * Decisiones MVP (ver `brain/files/Diseño - Autorellenar horas + ActivityWatch`):
 *  - Genera entradas reales (date+hours); el área y las tarifas las resuelve la capa
 *    que llama (no aquí, para mantener la función pura y testeable).
 *  - Respeta lo manual: descuenta sus horas del objetivo y NO reparte sobre días que ya
 *    tienen imputación manual (evita apilar dedicación sobre fichajes reales).
 *  - Reparto uniforme con redondeo a `roundingStep`; el último día absorbe el residual
 *    para que la suma case EXACTAMENTE con el déficit (sin deriva de céntimos de hora).
 */
import { listWorkingDays } from './feasibility'

export type AutoFillMode = 'percent' | 'monthly_hours'

export type AutoFillInput = {
  periodStart: string // 'YYYY-MM-DD'
  periodEnd: string // 'YYYY-MM-DD'
  /** Festivos (por región) ∪ vacaciones de la persona, como fechas 'YYYY-MM-DD'. */
  holidaySet: Set<string>
  mode: AutoFillMode
  /** Jornada diaria de referencia (p.ej. weeklyHours / 5). */
  dailyHours: number
  /** Modo 'percent': 0–100. */
  dedicationPercent?: number | null
  /** Modo 'monthly_hours': horas objetivo del mes completo. */
  monthlyTargetHours?: number | null
  /**
   * Modo 'monthly_hours': nº de días laborables del periodo COMPLETO (mes natural). Si se
   * indica y difiere de los días efectivos (alta/baja a mitad de mes), el objetivo se
   * pro-ratea. Si es null/0, el objetivo es `monthlyTargetHours` tal cual.
   */
  fullPeriodWorkingDays?: number | null
  /** Horas ya imputadas a mano por fecha; se respetan y descuentan del objetivo. */
  manualHoursByDate?: Record<string, number>
  /** Tamaño de redondeo en horas (default 0,25 = 15 min). */
  roundingStep?: number
}

export type AutoFillEntry = { date: string; hours: number }

export type AutoFillResult = {
  entries: AutoFillEntry[]
  targetHours: number
  manualHours: number
  filledHours: number
  workingDayCount: number
  candidateDayCount: number
  warnings: string[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Jornada diaria a partir de las horas semanales (5 días laborables). */
export function dailyHoursFromWeekly(weeklyHours: number): number {
  return weeklyHours / 5
}

export function computeAutoFill(input: AutoFillInput): AutoFillResult {
  const step = input.roundingStep ?? 0.25
  const manualByDate = input.manualHoursByDate ?? {}
  const warnings: string[] = []

  const workingDays = listWorkingDays(input.periodStart, input.periodEnd, input.holidaySet)
  const workingDayCount = workingDays.length

  // ── Horas objetivo del periodo ──────────────────────────────────────────────
  let targetHours: number
  if (input.mode === 'percent') {
    const pct = input.dedicationPercent ?? 0
    targetHours = workingDayCount * input.dailyHours * (pct / 100)
  } else {
    const monthly = input.monthlyTargetHours ?? 0
    targetHours =
      input.fullPeriodWorkingDays && input.fullPeriodWorkingDays > 0
        ? monthly * (workingDayCount / input.fullPeriodWorkingDays)
        : monthly
  }
  targetHours = round2(targetHours)

  // ── Horas manuales dentro del periodo laborable (se respetan y descuentan) ────
  let manualHours = 0
  for (const d of workingDays) manualHours += manualByDate[d] ?? 0
  manualHours = round2(manualHours)

  const deficit = round2(Math.max(0, targetHours - manualHours))

  // Candidatos: días laborables SIN imputación manual (no apilar auto sobre manual).
  const candidateDays = workingDays.filter((d) => !((manualByDate[d] ?? 0) > 0))
  const candidateDayCount = candidateDays.length

  const entries: AutoFillEntry[] = []
  let filledHours = 0

  if (workingDayCount === 0) {
    warnings.push('El periodo no tiene días laborables (todo festivos/vacaciones).')
  } else if (targetHours <= 0) {
    warnings.push('El objetivo de horas es 0; revisa la dedicación de la asignación.')
  } else if (deficit <= 0) {
    warnings.push('Las horas manuales ya cubren el objetivo; no hay nada que rellenar.')
  } else if (candidateDayCount === 0) {
    warnings.push('No hay días laborables libres para repartir (todos tienen imputación manual).')
  } else {
    const n = candidateDayCount
    // `base` como múltiplo de step por debajo del reparto exacto → el último día
    // absorbe el residual y la suma case exactamente con el déficit.
    const base = Math.floor(deficit / n / step) * step
    let acc = 0
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1
      const h = isLast ? round2(deficit - acc) : round2(base)
      if (h > 0) {
        entries.push({ date: candidateDays[i] as string, hours: h })
        filledHours += h
      }
      acc = round2(acc + h)
    }
    filledHours = round2(filledHours)

    const maxPerDay = entries.reduce((m, e) => Math.max(m, e.hours), 0)
    if (maxPerDay > input.dailyHours + 1e-9) {
      warnings.push(
        `El reparto supera la jornada diaria (${maxPerDay} h > ${input.dailyHours} h) en algún día.`,
      )
    }
  }

  return {
    entries,
    targetHours,
    manualHours,
    filledHours,
    workingDayCount,
    candidateDayCount,
    warnings,
  }
}
