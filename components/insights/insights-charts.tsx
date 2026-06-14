import { Card, Text, Group, Stack, SimpleGrid } from '@mantine/core'
import { formatEur } from '@/lib/margin'
import { marginColor } from '@/lib/tokens'
import type { RankItem, DonutSlice, TimePoint, HeatCell } from '@/lib/insights-data'
import { AREA_LABELS, CATEGORY_LABELS, INSIGHTS_AREAS, INSIGHTS_CATEGORIES } from '@/lib/insights-filters'

const PALETTE = ['#4263eb', '#37b24d', '#f59f00', '#7048e8', '#e8590c', '#1098ad', '#d6336c', '#74b816']

// ─── KPI en tonal container ──────────────────────────────────────────────────────

export type KpiTrend = {
  arrow: '▲' | '▼' | '→'
  label: string
  sentiment: 'good' | 'bad' | 'neutral'
}

const TREND_COLOR: Record<KpiTrend['sentiment'], string> = {
  good: 'var(--mantine-color-teal-7)',
  bad: 'var(--mantine-color-red-7)',
  neutral: 'var(--mantine-color-gray-6)',
}

export function KpiCard({
  label,
  value,
  sub,
  tone = 'blue',
  trend,
}: {
  label: string
  value: string
  sub?: string
  tone?: string
  trend?: KpiTrend
}) {
  return (
    <Card
      p="md"
      radius="md"
      style={{
        background: `var(--mantine-color-${tone}-light)`,
        border: 'none',
      }}
    >
      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
        {label}
      </Text>
      <Text fw={700} style={{ fontSize: '1.5rem', letterSpacing: '-0.02em', lineHeight: 1.2 }} mt={4}>
        {value}
      </Text>
      {trend && (
        <Text size="xs" fw={600} mt={3} style={{ color: TREND_COLOR[trend.sentiment] }}>
          {trend.arrow} {trend.label}
        </Text>
      )}
      {sub && (
        <Text size="xs" c="dimmed" mt={2}>
          {sub}
        </Text>
      )}
    </Card>
  )
}

// ─── Ranking de barras horizontales ──────────────────────────────────────────────

export function HorizontalBars({
  title,
  items,
  format,
}: {
  title: string
  items: RankItem[]
  format: (v: number) => string
}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)))
  return (
    <Card p="md" withBorder>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }} mb="sm">
        {title}
      </Text>
      {items.length === 0 ? (
        <Text size="sm" c="dimmed" py="lg" ta="center">
          Sin datos en este periodo.
        </Text>
      ) : (
        <Stack gap={8}>
          {items.map((it, i) => {
            const w = Math.max(2, (Math.abs(it.value) / max) * 100)
            const neg = it.value < 0
            return (
              <div key={it.id}>
                <Group justify="space-between" gap="xs" wrap="nowrap" mb={2}>
                  <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.label}
                  </Text>
                  <Text size="xs" fw={600} {...(neg ? { c: 'red' } : {})} style={{ flexShrink: 0 }}>
                    {it.secondary ?? format(it.value)}
                  </Text>
                </Group>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--mantine-color-gray-1)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${w}%`,
                      borderRadius: 4,
                      background: neg ? 'var(--mantine-color-red-5)' : PALETTE[i % PALETTE.length],
                    }}
                  />
                </div>
              </div>
            )
          })}
        </Stack>
      )}
    </Card>
  )
}

// ─── Donut SVG ───────────────────────────────────────────────────────────────────

export function Donut({
  title,
  slices,
  format,
}: {
  title: string
  slices: DonutSlice[]
  format: (v: number) => string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = 52
  const c = 2 * Math.PI * r
  const fracOf = (v: number) => (total > 0 ? v / total : 0)
  const arcs = slices.map((s, i) => {
    const frac = fracOf(s.value)
    const dash = frac * c
    // offset acumulado = suma de los arcos anteriores (sin mutación durante el render)
    const prev = slices.slice(0, i).reduce((acc, x) => acc + fracOf(x.value) * c, 0)
    return { dash, gap: c - dash, off: -prev, color: PALETTE[i % PALETTE.length]!, ...s, frac }
  })

  return (
    <Card p="md" withBorder>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }} mb="sm">
        {title}
      </Text>
      {total === 0 ? (
        <Text size="sm" c="dimmed" py="lg" ta="center">
          Sin datos en este periodo.
        </Text>
      ) : (
        <Group align="center" gap="lg" wrap="nowrap">
          <svg width={132} height={132} viewBox="0 0 132 132" style={{ flexShrink: 0 }}>
            <g transform="translate(66,66) rotate(-90)">
              {arcs.map((a, i) => (
                <circle
                  key={i}
                  r={r}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={16}
                  strokeDasharray={`${a.dash} ${a.gap}`}
                  strokeDashoffset={a.off}
                />
              ))}
            </g>
          </svg>
          <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
            {arcs.map((a, i) => (
              <Group key={i} justify="space-between" gap="xs" wrap="nowrap">
                <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                  <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.label}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {format(a.value)} · {Math.round(a.frac * 100)}%
                </Text>
              </Group>
            ))}
          </Stack>
        </Group>
      )}
    </Card>
  )
}

// ─── Línea temporal: revenue (barras) + margen (línea) ───────────────────────────

export function RevenueMarginTimeline({
  points,
  comparePoints,
  compareLabel,
}: {
  points: TimePoint[]
  comparePoints?: TimePoint[]
  compareLabel?: string
}) {
  const hasData = points.some((p) => p.revenueCents > 0)
  const cmp = comparePoints ?? []
  const hasCompare = cmp.some((p) => p.revenueCents > 0)
  const maxRev = Math.max(1, ...points.map((p) => p.revenueCents), ...cmp.map((p) => p.revenueCents))
  const margins = [...points, ...cmp].map((p) => p.marginPct ?? 0)
  const maxM = Math.max(10, ...margins)
  const minM = Math.min(0, ...margins)
  const rangeM = maxM - minM || 1

  const W = 640
  const H = 180
  const padX = 8
  const padY = 16
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const n = points.length
  const slot = n > 0 ? innerW / n : innerW
  const marginY = (m: number | null) => padY + innerH - ((((m ?? 0) - minM) / rangeM) * innerH)
  const revY = (rev: number) => padY + innerH - (rev / maxRev) * innerH

  const linePts = points
    .map((p, i) => `${(padX + slot * i + slot / 2).toFixed(1)},${marginY(p.marginPct).toFixed(1)}`)
    .join(' ')

  // Overlay de comparación: alineado por índice de posición (i-ésimo vs i-ésimo).
  const cmpMarginPts = hasCompare
    ? cmp
        .slice(0, n)
        .map((p, i) => `${(padX + slot * i + slot / 2).toFixed(1)},${marginY(p.marginPct).toFixed(1)}`)
        .join(' ')
    : ''
  const cmpRevPts = hasCompare
    ? cmp
        .slice(0, n)
        .map((p, i) => `${(padX + slot * i + slot / 2).toFixed(1)},${revY(p.revenueCents).toFixed(1)}`)
        .join(' ')
    : ''

  return (
    <Card p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
          Ingresos y margen mes a mes
        </Text>
        <Group gap="md">
          <Group gap={4}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--mantine-color-blue-4)' }} />
            <Text size="xs" c="dimmed">Ingresos</Text>
          </Group>
          <Group gap={4}>
            <span style={{ width: 12, height: 2, background: 'var(--mantine-color-teal-6)' }} />
            <Text size="xs" c="dimmed">Margen %</Text>
          </Group>
          {hasCompare && (
            <Group gap={4}>
              <span style={{ width: 12, height: 0, borderTop: '2px dashed var(--mantine-color-gray-5)' }} />
              <Text size="xs" c="dimmed">{compareLabel ?? 'Comparación'}</Text>
            </Group>
          )}
        </Group>
      </Group>
      {!hasData ? (
        <Text size="sm" c="dimmed" py="lg" ta="center">
          Sin ingresos en este periodo.
        </Text>
      ) : (
        <>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            {/* barras de revenue */}
            {points.map((p, i) => {
              const h = (p.revenueCents / maxRev) * innerH
              const x = padX + slot * i + slot * 0.2
              const bw = slot * 0.6
              return (
                <rect
                  key={i}
                  x={x}
                  y={padY + innerH - h}
                  width={bw}
                  height={Math.max(0, h)}
                  rx={2}
                  fill="var(--mantine-color-blue-3)"
                >
                  <title>{`${p.month}: ${formatEur(p.revenueCents)}`}</title>
                </rect>
              )
            })}
            {/* overlay de comparación (ingresos + margen, líneas discontinuas) */}
            {hasCompare && n > 1 && (
              <>
                <polyline
                  points={cmpRevPts}
                  fill="none"
                  stroke="var(--mantine-color-blue-3)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.7}
                />
                <polyline
                  points={cmpMarginPts}
                  fill="none"
                  stroke="var(--mantine-color-gray-5)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              </>
            )}
            {/* línea de margen */}
            {n > 1 && (
              <polyline points={linePts} fill="none" stroke="var(--mantine-color-teal-6)" strokeWidth={2} />
            )}
            {points.map((p, i) => {
              const x = padX + slot * i + slot / 2
              const y = marginY(p.marginPct)
              return (
                <circle key={i} cx={x} cy={y} r={2.5} fill="var(--mantine-color-teal-7)">
                  <title>{`${p.month}: ${p.marginPct === null ? '—' : p.marginPct.toFixed(1) + '%'}`}</title>
                </circle>
              )
            })}
          </svg>
          <Group justify="space-between" mt={4}>
            {points.map((p, i) => (
              <Text key={i} size="9px" c="dimmed" style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {p.month.slice(2)}
              </Text>
            ))}
          </Group>
        </>
      )}
    </Card>
  )
}

// ─── Heatmap área × categoría (margen por celda) ─────────────────────────────────

function heatBg(m: number | null): string {
  if (m === null) return 'var(--mantine-color-gray-0)'
  const color = marginColor(m)
  const shade = m >= 30 ? 5 : m >= 20 ? 4 : m >= 10 ? 3 : m >= 0 ? 3 : 5
  return `var(--mantine-color-${color}-${shade})`
}

export function MarginHeatmap({ cells }: { cells: HeatCell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.area}|${c.category}`, c]))
  const areasWith = INSIGHTS_AREAS.filter((a) => cells.some((c) => c.area === a))
  const catsWith = INSIGHTS_CATEGORIES.filter((c) => cells.some((x) => x.category === c))

  return (
    <Card p="md" withBorder>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }} mb="sm">
        Margen por área × categoría
      </Text>
      {cells.length === 0 ? (
        <Text size="sm" c="dimmed" py="lg" ta="center">
          Sin datos en este periodo.
        </Text>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%' }}>
            <thead>
              <tr>
                <th />
                {catsWith.map((c) => (
                  <th key={c} style={{ padding: '2px 4px' }}>
                    <Text size="xs" c="dimmed" fw={500} ta="center">
                      {CATEGORY_LABELS[c]}
                    </Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areasWith.map((a) => (
                <tr key={a}>
                  <td style={{ paddingRight: 6 }}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {AREA_LABELS[a]}
                    </Text>
                  </td>
                  {catsWith.map((c) => {
                    const cell = byKey.get(`${a}|${c}`)
                    const m = cell?.marginPct ?? null
                    return (
                      <td key={c} style={{ minWidth: 56 }}>
                        <div
                          title={cell ? `${AREA_LABELS[a]} · ${CATEGORY_LABELS[c]}: ${m === null ? '—' : m.toFixed(1) + '%'}` : 'Sin datos'}
                          style={{
                            height: 38,
                            borderRadius: 6,
                            background: cell ? heatBg(m) : 'transparent',
                            border: cell ? 'none' : '1px dashed var(--mantine-color-gray-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {cell && (
                            <Text size="xs" fw={600} c={m !== null && m >= 0 ? 'white' : 'white'}>
                              {m === null ? '—' : `${Math.round(m)}%`}
                            </Text>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── Grid contenedor para los KPIs ───────────────────────────────────────────────

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
      {children}
    </SimpleGrid>
  )
}
