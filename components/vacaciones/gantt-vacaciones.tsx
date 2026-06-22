'use client'

import { useRef, useEffect } from 'react'
import { Tooltip } from '@mantine/core'
import type { PersonBalance } from '@/lib/sheets-vacaciones'

// ─── Layout ──────────────────────────────────────────────────────────────────

const COL_W  = 28
const ROW_H  = 30
const NAME_W = 152
const HDR_H  = 44
const BAR_H  = 14
const BAR_Y  = (ROW_H - BAR_H) / 2

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().split('T')[0]!
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  let cur = start
  while (cur <= end) { days.push(cur); cur = addDays(cur, 1) }
  return days
}

function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
  return dow === 0 || dow === 6
}

function dayNum(iso: string): number {
  return parseInt(iso.split('-')[2]!, 10)
}

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

type MonthGroup = { label: string; count: number; startIdx: number }

function getMonthGroups(days: string[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  let cur: MonthGroup | null = null
  days.forEach((d, i) => {
    const m = parseInt(d.split('-')[1]!, 10)
    const label = MONTHS_ES[m - 1]!
    if (!cur || cur.label !== label) { cur = { label, count: 1, startIdx: i }; groups.push(cur) }
    else cur.count++
  })
  return groups
}

function isHolidayFor(date: string, region: string, holidays: Record<string, string[]>): boolean {
  const regions = holidays[date]
  if (!regions) return false
  return regions.includes('ES') || regions.includes(region)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GanttVacaciones({
  people,
  today,
  holidays = {},
  personRegions = {},
}: {
  people: PersonBalance[]
  today: string
  holidays?: Record<string, string[]>
  personRegions?: Record<string, string>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const startDate   = addDays(today, -7)
  const endDate     = addDays(today, 155)
  const days        = getDaysInRange(startDate, endDate)
  const totalW      = days.length * COL_W
  const todayIdx    = days.indexOf(today)
  const todayX      = todayIdx >= 0 ? todayIdx * COL_W + COL_W / 2 : -1
  const monthGroups = getMonthGroups(days)

  // Scroll to today on mount
  useEffect(() => {
    if (!scrollRef.current || todayIdx < 0) return
    scrollRef.current.scrollLeft = Math.max(0, todayIdx * COL_W - 80)
  }, [todayIdx])

  const sorted = [...people].sort((a, b) => {
    if (a.isBaja !== b.isBaja) return a.isBaja ? 1 : -1
    const aActive = a.vacations.some((v) => v.start <= today && v.end >= today) ? 0 : 1
    const bActive = b.vacations.some((v) => v.start <= today && v.end >= today) ? 0 : 1
    return aActive - bActive || a.name.localeCompare(b.name)
  })

  const totalH = HDR_H + sorted.length * ROW_H

  return (
    <div style={{ display: 'flex', border: '1px solid var(--h-bd)', borderRadius: 8, overflow: 'hidden', background: 'var(--h-shell)' }}>

      {/* Names column */}
      <div style={{ width: NAME_W, flexShrink: 0, borderRight: '1px solid var(--h-bd)', background: 'var(--h-shell)', zIndex: 2 }}>
        <div style={{ height: HDR_H, borderBottom: '1px solid var(--h-bd)' }} />
        {sorted.map((p, i) => (
          <div
            key={p.name}
            style={{
              height: ROW_H,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              paddingRight: 8,
              borderBottom: i < sorted.length - 1 ? '1px solid var(--h-bd)' : undefined,
              fontSize: 12,
              fontWeight: p.isBaja || p.isExcedencia ? 400 : 500,
              opacity: p.isBaja || p.isExcedencia ? 0.4 : 1,
              color: 'var(--h-t1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {p.name}
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: totalW, height: totalH }}>

          {/* Weekend + today backgrounds */}
          {days.map((d, i) => {
            const weekend = isWeekend(d)
            const isToday = d === today
            if (!weekend && !isToday) return null
            return (
              <div key={d} style={{
                position: 'absolute', left: i * COL_W, top: 0, width: COL_W, height: totalH,
                background: isToday ? 'var(--h-accent-bg)' : 'var(--h-surface)',
                pointerEvents: 'none',
              }} />
            )
          })}

          {/* Column borders */}
          {days.map((d, i) => (
            <div key={`b-${d}`} style={{
              position: 'absolute', left: i * COL_W + COL_W - 1, top: 0, width: 1, height: totalH,
              background: 'var(--h-bd)', opacity: isWeekend(d) ? 0.3 : 0.45,
            }} />
          ))}

          {/* Month headers */}
          {monthGroups.map((mg) => (
            <div key={`mg-${mg.startIdx}`} style={{
              position: 'absolute', left: mg.startIdx * COL_W + 6, top: 4,
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--h-t2)', pointerEvents: 'none',
            }}>
              {mg.label}
            </div>
          ))}

          {/* Day numbers */}
          {days.map((d, i) => {
            const weekend = isWeekend(d)
            const isToday = d === today
            return (
              <div key={`n-${d}`} style={{
                position: 'absolute', left: i * COL_W, top: 22, width: COL_W, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              }}>
                {isToday ? (
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--mantine-color-blue-6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#fff',
                  }}>
                    {dayNum(d)}
                  </div>
                ) : (
                  <span style={{ fontSize: 10, color: weekend ? 'var(--h-t3)' : 'var(--h-t2)' }}>
                    {dayNum(d)}
                  </span>
                )}
              </div>
            )
          })}

          {/* Header bottom border */}
          <div style={{ position: 'absolute', left: 0, top: HDR_H - 1, width: totalW, height: 1, background: 'var(--h-bd)' }} />

          {/* Per-row: holidays + separator + bars */}
          {sorted.map((p, rowIdx) => {
            const rowTop = HDR_H + rowIdx * ROW_H
            const region = personRegions[p.name] ?? 'ES-MD'

            return (
              <div key={`row-${p.name}`}>
                {/* Holiday shading (weekday festivos for this person's region) */}
                {days.map((d, i) => {
                  if (isWeekend(d)) return null
                  if (!isHolidayFor(d, region, holidays)) return null
                  return (
                    <div key={`h-${d}`} style={{
                      position: 'absolute', left: i * COL_W, top: rowTop,
                      width: COL_W, height: ROW_H,
                      background: 'rgba(0,0,0,0.07)', pointerEvents: 'none',
                    }} />
                  )
                })}

                {/* Row separator */}
                {rowIdx < sorted.length - 1 && (
                  <div style={{
                    position: 'absolute', left: 0, top: rowTop + ROW_H - 1,
                    width: totalW, height: 1, background: 'var(--h-bd)', opacity: 0.45,
                  }} />
                )}

                {/* Vacation bars */}
                {p.vacations
                  .filter((v) => v.end >= startDate && v.start <= endDate && v.status !== 'bloqueado')
                  .map((v, vi) => {
                    const cs = v.start < startDate ? startDate : v.start
                    const ce = v.end > endDate ? endDate : v.end
                    const si = days.indexOf(cs)
                    const ei = days.indexOf(ce)
                    if (si === -1 || ei === -1) return null
                    const x = si * COL_W + 2
                    const w = (ei - si + 1) * COL_W - 4
                    if (w <= 0) return null

                    const isPaternal = v.status === 'baja_paternal'
                    const isApproved = v.status === 'aprobado'
                    const bg = isPaternal ? 'var(--mantine-color-violet-5)'
                             : isApproved ? 'var(--mantine-color-green-5)'
                             : 'var(--mantine-color-yellow-4)'
                    const textColor = isPaternal || isApproved ? '#fff' : 'rgba(0,0,0,0.7)'
                    const tooltipLabel = isPaternal ? `${p.name} · Baja paternal · ${v.start} → ${v.end}`
                                       : isApproved ? `${p.name} · Aprobado · ${v.start} → ${v.end} · ${v.days}d`
                                       : `${p.name} · Pendiente de aprobación · ${v.start} → ${v.end} · ${v.days}d`
                    const showLabel = w > COL_W * 2.5
                    const barLabel  = isPaternal ? 'Paternal' : isApproved ? `${v.days}d` : `${v.days}d`

                    return (
                      <Tooltip key={`bar-${p.name}-${vi}`} label={tooltipLabel} withArrow fz="xs" position="top">
                        <div style={{
                          position: 'absolute', left: x, top: rowTop + BAR_Y,
                          width: w, height: BAR_H, borderRadius: 4, background: bg,
                          display: 'flex', alignItems: 'center',
                          paddingLeft: showLabel ? 6 : 0,
                          overflow: 'hidden', cursor: 'default', boxSizing: 'border-box',
                        }}>
                          {showLabel && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {barLabel}
                            </span>
                          )}
                        </div>
                      </Tooltip>
                    )
                  })}
              </div>
            )
          })}

          {/* Today line */}
          {todayX >= 0 && (
            <div style={{
              position: 'absolute', left: todayX - 1, top: HDR_H,
              width: 2, height: totalH - HDR_H,
              background: 'var(--mantine-color-blue-5)', opacity: 0.4,
              borderRadius: 1, pointerEvents: 'none',
            }} />
          )}

        </div>
      </div>
    </div>
  )
}
