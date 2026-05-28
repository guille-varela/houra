'use client'

import type { PersonBalance } from '@/lib/sheets-vacaciones'

// ─── Layout constants ────────────────────────────────────────────────────────

const COL_W  = 32   // px per day
const ROW_H  = 40   // px per person row
const NAME_W = 152  // px for name column
const HDR_H  = 48   // px for 2-row header (month + day number)
const BAR_H  = 22   // height of vacation pill
const BAR_Y  = (ROW_H - BAR_H) / 2

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + n))
  return date.toISOString().split('T')[0]!
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
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
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type MonthGroup = { label: string; count: number; startIdx: number }

function getMonthGroups(days: string[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  let cur: MonthGroup | null = null
  days.forEach((d, i) => {
    const m = parseInt(d.split('-')[1]!, 10)
    const label = MONTHS_ES[m - 1]!
    if (!cur || cur.label !== label) {
      cur = { label, count: 1, startIdx: i }
      groups.push(cur)
    } else {
      cur.count++
    }
  })
  return groups
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GanttVacaciones({
  people,
  today,
}: {
  people: PersonBalance[]
  today: string
}) {
  // Window: 7 days before today → 52 days after (~2 months)
  const startDate = addDays(today, -7)
  const endDate   = addDays(today, 52)
  const days      = getDaysInRange(startDate, endDate)
  const totalW    = days.length * COL_W
  const todayIdx  = days.indexOf(today)
  const todayX    = todayIdx >= 0 ? todayIdx * COL_W + COL_W / 2 : -1
  const monthGroups = getMonthGroups(days)

  // Sort: active vacationers first, then alphabetical, baja at bottom
  const sorted = [...people].sort((a, b) => {
    if (a.isBaja !== b.isBaja) return a.isBaja ? 1 : -1
    const aActive = a.vacations.some((v) => v.start <= today && v.end >= today) ? 0 : 1
    const bActive = b.vacations.some((v) => v.start <= today && v.end >= today) ? 0 : 1
    return aActive - bActive || a.name.localeCompare(b.name)
  })

  const totalH = HDR_H + sorted.length * ROW_H

  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--h-bd)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--h-shell)',
      }}
    >
      {/* ── Names column (fixed) ─────────────────────────────────── */}
      <div
        style={{
          width: NAME_W,
          flexShrink: 0,
          borderRight: '1px solid var(--h-bd)',
          background: 'var(--h-shell)',
          zIndex: 2,
        }}
      >
        {/* Header spacer */}
        <div style={{ height: HDR_H, borderBottom: '1px solid var(--h-bd)' }} />

        {/* Person rows */}
        {sorted.map((p) => (
          <div
            key={p.name}
            style={{
              height: ROW_H,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              paddingRight: 8,
              borderBottom: '1px solid var(--h-bd)',
              fontSize: 13,
              fontWeight: p.isBaja ? 400 : 500,
              opacity: p.isBaja ? 0.4 : 1,
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

      {/* ── Timeline (scrollable) ────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: totalW, height: totalH }}>

          {/* ── Column backgrounds (weekends + today) ──────────── */}
          {days.map((d, i) => {
            const weekend = isWeekend(d)
            const isToday = d === today
            if (!weekend && !isToday) return null
            return (
              <div
                key={d}
                style={{
                  position: 'absolute',
                  left: i * COL_W,
                  top: 0,
                  width: COL_W,
                  height: totalH,
                  background: isToday
                    ? 'rgba(74, 144, 226, 0.08)'
                    : 'var(--h-surface)',
                  pointerEvents: 'none',
                }}
              />
            )
          })}

          {/* ── Column right borders ───────────────────────────── */}
          {days.map((d, i) => (
            <div
              key={`border-${d}`}
              style={{
                position: 'absolute',
                left: i * COL_W + COL_W - 1,
                top: 0,
                width: 1,
                height: totalH,
                background: 'var(--h-bd)',
                opacity: isWeekend(d) ? 0.4 : 0.6,
              }}
            />
          ))}

          {/* ── Month headers ──────────────────────────────────── */}
          {monthGroups.map((mg) => (
            <div
              key={`mg-${mg.startIdx}`}
              style={{
                position: 'absolute',
                left: mg.startIdx * COL_W + 8,
                top: 4,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--h-t2)',
                pointerEvents: 'none',
              }}
            >
              {mg.label}
            </div>
          ))}

          {/* ── Day numbers ────────────────────────────────────── */}
          {days.map((d, i) => {
            const weekend = isWeekend(d)
            const isToday = d === today
            const num = dayNum(d)
            return (
              <div
                key={`num-${d}`}
                style={{
                  position: 'absolute',
                  left: i * COL_W,
                  top: 24,
                  width: COL_W,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {isToday ? (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--mantine-color-blue-6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {num}
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      color: weekend ? 'var(--h-t3)' : 'var(--h-t2)',
                    }}
                  >
                    {num}
                  </span>
                )}
              </div>
            )
          })}

          {/* ── Header bottom border ───────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: HDR_H - 1,
              width: totalW,
              height: 1,
              background: 'var(--h-bd)',
            }}
          />

          {/* ── Row separators ────────────────────────────────── */}
          {sorted.map((_, rowIdx) => (
            <div
              key={`row-sep-${rowIdx}`}
              style={{
                position: 'absolute',
                left: 0,
                top: HDR_H + (rowIdx + 1) * ROW_H - 1,
                width: totalW,
                height: 1,
                background: 'var(--h-bd)',
                opacity: 0.6,
              }}
            />
          ))}

          {/* ── Today vertical line ────────────────────────────── */}
          {todayX >= 0 && (
            <div
              style={{
                position: 'absolute',
                left: todayX - 1,
                top: HDR_H,
                width: 2,
                height: totalH - HDR_H,
                background: 'var(--mantine-color-blue-5)',
                opacity: 0.45,
                borderRadius: 1,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* ── Vacation bars ─────────────────────────────────── */}
          {sorted.map((p, rowIdx) => {
            const rowTop = HDR_H + rowIdx * ROW_H
            return p.vacations
              .filter((v) => v.end >= startDate && v.start <= endDate)
              .map((v, vi) => {
                // Clamp to visible window
                const clampedStart = v.start < startDate ? startDate : v.start
                const clampedEnd   = v.end > endDate ? endDate : v.end
                const si = days.indexOf(clampedStart)
                const ei = days.indexOf(clampedEnd)
                if (si === -1 || ei === -1) return null

                const x = si * COL_W + 3
                const w = (ei - si + 1) * COL_W - 6
                if (w <= 0) return null

                const isAprobado  = v.status === 'aprobado'
                const isPaternal  = v.status === 'baja_paternal'
                const bg   = isPaternal  ? 'var(--mantine-color-violet-5)'
                           : isAprobado  ? 'var(--mantine-color-green-5)'
                           : 'var(--mantine-color-yellow-4)'
                const text = isPaternal || isAprobado ? '#fff' : 'rgba(0,0,0,0.75)'
                const showLabel = w > COL_W * 2

                return (
                  <div
                    key={`${p.name}-bar-${vi}`}
                    title={`${p.name} · ${v.start} → ${v.end} · ${v.days}d · ${isPaternal ? 'Baja paternal' : v.status}`}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: rowTop + BAR_Y,
                      width: w,
                      height: BAR_H,
                      borderRadius: 5,
                      background: bg,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: showLabel ? 7 : 0,
                      overflow: 'hidden',
                      cursor: 'default',
                      boxSizing: 'border-box',
                    }}
                  >
                    {showLabel && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isPaternal ? 'Paternal' : `${v.days}d`}
                      </span>
                    )}
                  </div>
                )
              })
          })}

        </div>
      </div>
    </div>
  )
}
