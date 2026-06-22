import { describe, it, expect } from 'vitest'
import { computeAutoFill, dailyHoursFromWeekly, type AutoFillInput } from './auto-fill'

// Enero 2026: 22 días laborables (L–V), sin festivos. 1-ene es jueves.
const JAN = { periodStart: '2026-01-01', periodEnd: '2026-01-31' }
const noHolidays = new Set<string>()

function base(overrides: Partial<AutoFillInput>): AutoFillInput {
  return {
    ...JAN,
    holidaySet: noHolidays,
    mode: 'percent',
    dailyHours: 7.5,
    dedicationPercent: 50,
    ...overrides,
  }
}

describe('dailyHoursFromWeekly', () => {
  it('divide la jornada semanal entre 5', () => {
    expect(dailyHoursFromWeekly(37.5)).toBe(7.5)
    expect(dailyHoursFromWeekly(40)).toBe(8)
  })
})

describe('computeAutoFill — modo percent', () => {
  it('reparte el objetivo y la suma case exactamente', () => {
    const r = computeAutoFill(base({ dedicationPercent: 50 }))
    // 22 laborables × 7.5 × 50% = 82.5h
    expect(r.workingDayCount).toBe(22)
    expect(r.targetHours).toBe(82.5)
    expect(r.manualHours).toBe(0)
    expect(r.entries.length).toBe(22)
    const sum = r.entries.reduce((s, e) => s + e.hours, 0)
    expect(Math.round(sum * 100) / 100).toBe(82.5)
    expect(r.filledHours).toBe(82.5)
    expect(r.warnings).toEqual([])
  })

  it('el último día absorbe el residual cuando no es múltiplo del step', () => {
    // 22 × 8 × 33% = 58.08h; reparto a 0.25 deja residual en el último día
    const r = computeAutoFill(base({ dailyHours: 8, dedicationPercent: 33 }))
    expect(r.targetHours).toBe(58.08)
    const sum = r.entries.reduce((s, e) => s + e.hours, 0)
    expect(Math.round(sum * 100) / 100).toBe(58.08)
    // todos menos el último son múltiplos de 0.25
    const allButLast = r.entries.slice(0, -1)
    for (const e of allButLast) expect((e.hours / 0.25) % 1).toBe(0)
  })
})

describe('computeAutoFill — modo monthly_hours', () => {
  it('usa las horas/mes tal cual sin pro-rata', () => {
    const r = computeAutoFill(base({ mode: 'monthly_hours', monthlyTargetHours: 44, dedicationPercent: null }))
    expect(r.targetHours).toBe(44)
    const sum = r.entries.reduce((s, e) => s + e.hours, 0)
    expect(Math.round(sum * 100) / 100).toBe(44)
  })

  it('pro-ratea por días efectivos vs mes completo (alta a mitad de mes)', () => {
    // Periodo efectivo desde el 16 (alta) → menos días; objetivo escalado
    const r = computeAutoFill(
      base({
        periodStart: '2026-01-16',
        mode: 'monthly_hours',
        monthlyTargetHours: 44,
        fullPeriodWorkingDays: 22,
        dedicationPercent: null,
      }),
    )
    // 11 laborables del 16 al 31 → 44 × 11/22 = 22
    expect(r.workingDayCount).toBe(11)
    expect(r.targetHours).toBe(22)
  })

  it('avisa si el reparto supera la jornada diaria', () => {
    const r = computeAutoFill(
      base({ mode: 'monthly_hours', monthlyTargetHours: 220, dedicationPercent: null }),
    )
    // 220 / 22 = 10h/día > 7.5h → warning
    expect(r.warnings.some((w) => w.includes('jornada diaria'))).toBe(true)
  })
})

describe('computeAutoFill — respeta lo manual', () => {
  it('descuenta horas manuales del objetivo y no reparte sobre días con manual', () => {
    const r = computeAutoFill(
      base({
        dedicationPercent: 50, // objetivo 82.5
        manualHoursByDate: { '2026-01-05': 5, '2026-01-06': 3 },
      }),
    )
    expect(r.manualHours).toBe(8)
    // déficit = 82.5 - 8 = 74.5, repartido en 22 - 2 = 20 días candidatos
    expect(r.candidateDayCount).toBe(20)
    expect(r.filledHours).toBe(74.5)
    // ningún auto cae en los días manuales
    const autoDates = new Set(r.entries.map((e) => e.date))
    expect(autoDates.has('2026-01-05')).toBe(false)
    expect(autoDates.has('2026-01-06')).toBe(false)
  })

  it('no rellena si lo manual ya cubre el objetivo', () => {
    const r = computeAutoFill(
      base({
        mode: 'monthly_hours',
        monthlyTargetHours: 10,
        dedicationPercent: null,
        manualHoursByDate: { '2026-01-05': 12 },
      }),
    )
    expect(r.entries).toEqual([])
    expect(r.warnings.some((w) => w.includes('cubren el objetivo'))).toBe(true)
  })
})

describe('computeAutoFill — edge cases', () => {
  it('avisa si no hay días laborables', () => {
    // periodo de un sábado a un domingo
    const r = computeAutoFill(base({ periodStart: '2026-01-03', periodEnd: '2026-01-04' }))
    expect(r.workingDayCount).toBe(0)
    expect(r.entries).toEqual([])
    expect(r.warnings.some((w) => w.includes('días laborables'))).toBe(true)
  })

  it('excluye festivos del set y reduce el objetivo en modo percent', () => {
    const withHoliday = computeAutoFill(base({ holidaySet: new Set(['2026-01-01']) }))
    expect(withHoliday.workingDayCount).toBe(21)
    // 21 × 7.5 × 50% = 78.75
    expect(withHoliday.targetHours).toBe(78.75)
  })

  it('avisa si el objetivo es 0', () => {
    const r = computeAutoFill(base({ dedicationPercent: 0 }))
    expect(r.entries).toEqual([])
    expect(r.warnings.some((w) => w.includes('objetivo de horas es 0'))).toBe(true)
  })
})
