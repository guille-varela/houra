import { Card, Text, Group, Stack } from '@mantine/core'
import { formatEur } from '@/lib/margin'
import { chartPalette } from '@/lib/tokens'

const BAR_PALETTE = chartPalette

// ─── Revenue mes a mes (SVG, sin dependencias) ─────────────────────────────────

export function MonthlyRevenueChart({ data }: { data: Array<{ label: string; revenueCents: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.revenueCents))
  const hasData = data.some((d) => d.revenueCents > 0)

  return (
    <Card p="md" withBorder>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }} mb="sm">
        Evolución de ingresos (12 meses)
      </Text>
      {!hasData ? (
        <Text size="sm" c="dimmed" py="lg" ta="center">Aún no hay ingresos imputados.</Text>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {data.map((d, i) => {
            const h = Math.round((d.revenueCents / max) * 100)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  title={`${d.label}: ${formatEur(d.revenueCents)}`}
                  style={{
                    width: '100%', height: `${Math.max(h, d.revenueCents > 0 ? 3 : 0)}%`,
                    minHeight: d.revenueCents > 0 ? 3 : 0,
                    background: 'var(--mantine-color-blue-5)', borderRadius: '3px 3px 0 0',
                  }}
                />
                <Text size="9px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{d.label}</Text>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Distribución del esfuerzo entre proyectos (stacked bar) ───────────────────

export function EffortDistribution({ items }: { items: Array<{ name: string; hours: number }> }) {
  const total = items.reduce((s, x) => s + x.hours, 0)
  const withColor = items
    .filter((x) => x.hours > 0)
    .map((x, i) => ({ ...x, color: BAR_PALETTE[i % BAR_PALETTE.length]!, pct: total > 0 ? (x.hours / total) * 100 : 0 }))

  return (
    <Card p="md" withBorder>
      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }} mb="sm">
        Distribución del esfuerzo
      </Text>
      {withColor.length === 0 ? (
        <Text size="sm" c="dimmed" py="lg" ta="center">Sin horas consumidas todavía.</Text>
      ) : (
        <Stack gap="sm">
          <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }}>
            {withColor.map((x, i) => (
              <div key={i} title={`${x.name}: ${x.hours.toFixed(0)}h`} style={{ width: `${x.pct}%`, background: x.color }} />
            ))}
          </div>
          <Stack gap={4}>
            {withColor.map((x, i) => (
              <Group key={i} justify="space-between" gap="xs" wrap="nowrap">
                <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: x.color, flexShrink: 0 }} />
                  <Text size="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</Text>
                </Group>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{x.hours.toFixed(0)}h · {x.pct.toFixed(0)}%</Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      )}
    </Card>
  )
}
