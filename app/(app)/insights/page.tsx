import { redirect } from 'next/navigation'
import { Stack, Group, Text, Card, SimpleGrid, Badge } from '@mantine/core'
import { getCurrentPerson, canAccessInsights } from '@/lib/auth-helpers'
import { parseInsightsFilters, COMPARE_LABELS } from '@/lib/insights-filters'
import { getInsights, getInsightsFilterOptions, getBagSummary } from '@/lib/insights-data'
import InsightsFilterBar from '@/components/insights/insights-filter-bar'
import {
  KpiGrid,
  KpiCard,
  HorizontalBars,
  Donut,
  RevenueMarginTimeline,
  MarginHeatmap,
  type KpiTrend,
} from '@/components/insights/insights-charts'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function fmtHours(h: number): string {
  return `${h.toLocaleString('es-ES', { maximumFractionDigits: 0 })}h`
}
function fmtEurShort(cents: number): string {
  const eur = cents / 100
  if (Math.abs(eur) >= 1000) return `${(eur / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k €`
  return `${eur.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`
}

// ─── Tendencias vs periodo de comparación (F3.5 Ola 2) ───────────────────────────

function arrowOf(delta: number): KpiTrend['arrow'] {
  if (delta > 0.0001) return '▲'
  if (delta < -0.0001) return '▼'
  return '→'
}

/** Tendencia para métricas de valor (horas, ingresos, coste): variación %. */
function valueTrend(
  curr: number,
  prev: number,
  suffix: string,
  goodWhen: 'up' | 'down' | 'none',
): KpiTrend {
  const d = curr - prev
  const arrow = arrowOf(d)
  let sentiment: KpiTrend['sentiment'] = 'neutral'
  if (goodWhen !== 'none' && Math.abs(d) > 0.0001) {
    const isUp = d > 0
    sentiment = (goodWhen === 'up' ? isUp : !isUp) ? 'good' : 'bad'
  }
  const label =
    prev === 0 ? `sin base ${suffix}` : `${Math.abs((d / Math.abs(prev)) * 100).toFixed(1)}% ${suffix}`
  return { arrow, label, sentiment }
}

/** Tendencia para el margen: variación en puntos porcentuales (pp). */
function marginTrend(curr: number | null, prev: number | null, suffix: string): KpiTrend | undefined {
  if (curr === null || prev === null) return undefined
  const d = curr - prev
  return {
    arrow: arrowOf(d),
    label: `${Math.abs(d).toFixed(1)} pp ${suffix}`,
    sentiment: Math.abs(d) < 0.05 ? 'neutral' : d > 0 ? 'good' : 'bad',
  }
}

/** Tendencia para conteos (proyectos, personas): delta absoluto. */
function countTrend(curr: number, prev: number, suffix: string): KpiTrend {
  const d = curr - prev
  return { arrow: arrowOf(d), label: `${d > 0 ? '+' : ''}${d} ${suffix}`, sentiment: 'neutral' }
}

export default async function InsightsPage({ searchParams }: Props) {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  if (!canAccessInsights(person)) redirect('/today')

  const filters = parseInsightsFilters(await searchParams)
  const [options, data, bag] = await Promise.all([
    getInsightsFilterOptions(person.organizationId),
    getInsights(person.organizationId, filters),
    getBagSummary(person.organizationId, filters),
  ])

  const { kpis, compare } = data
  const cmp = compare?.kpis ?? null
  const suffix = compare ? `vs ${COMPARE_LABELS[compare.mode].toLowerCase()}` : ''

  return (
    <Stack p="md" gap="lg">
      <div>
        <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Insights</Text>
        <Text size="xs" c="dimmed">
          Inteligencia de negocio: sumatorios y comparativas con filtros combinables.
        </Text>
      </div>

      <InsightsFilterBar filters={filters} options={options} />

      {bag && (
        <div>
          <Group justify="space-between" align="baseline" mb={6}>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
              Bolsa de horas · cartera
            </Text>
            <Text size="xs" c="dimmed">
              {bag.projectCount} {bag.projectCount === 1 ? 'proyecto con bolsa' : 'proyectos con bolsa'} · totales a vida de proyecto (no dependen del periodo ni de la persona). Excluye capacidad continua y cuota mensual.
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <KpiCard label="Horas vendidas" value={fmtHours(bag.soldHours)} tone="violet" />
            <KpiCard label="Horas consumidas" value={fmtHours(bag.consumedHours)} tone="blue" />
            <KpiCard
              label="Horas restantes"
              value={fmtHours(bag.remainingHours)}
              tone={bag.remainingHours < 0 ? 'red' : 'green'}
            />
            <KpiCard
              label="% consumido"
              value={bag.consumedPct === null ? '—' : `${bag.consumedPct.toFixed(0)}%`}
              tone={
                bag.consumedPct === null
                  ? 'gray'
                  : bag.consumedPct >= 100
                    ? 'red'
                    : bag.consumedPct >= 80
                      ? 'orange'
                      : 'green'
              }
            />
          </SimpleGrid>
        </div>
      )}

      {data.rowCount === 0 ? (
        <Card withBorder>
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No hay datos para los filtros seleccionados. Prueba a ampliar el periodo o quitar filtros.
          </Text>
        </Card>
      ) : (
        <>
          {/* KPIs en tonal containers */}
          <KpiGrid>
            <KpiCard
              label="Horas consumidas"
              value={fmtHours(kpis.hours)}
              tone="blue"
              {...(cmp ? { trend: valueTrend(kpis.hours, cmp.hours, suffix, 'none') } : {})}
            />
            <KpiCard
              label="Ingresos"
              value={fmtEurShort(kpis.revenueCents)}
              tone="teal"
              {...(cmp ? { trend: valueTrend(kpis.revenueCents, cmp.revenueCents, suffix, 'up') } : {})}
            />
            <KpiCard
              label="Coste"
              value={fmtEurShort(kpis.costCents)}
              tone="orange"
              {...(cmp ? { trend: valueTrend(kpis.costCents, cmp.costCents, suffix, 'down') } : {})}
            />
            <KpiCard
              label="Margen ponderado"
              value={kpis.marginPct === null ? '—' : `${kpis.marginPct.toFixed(1)}%`}
              tone={
                kpis.marginPct === null
                  ? 'gray'
                  : kpis.marginPct >= 30
                    ? 'green'
                    : kpis.marginPct >= 15
                      ? 'yellow'
                      : 'red'
              }
              {...(cmp ? (() => {
                const t = marginTrend(kpis.marginPct, cmp.marginPct, suffix)
                return t ? { trend: t } : {}
              })() : {})}
            />
            <KpiCard
              label="Proyectos activos"
              value={String(kpis.activeProjects)}
              tone="grape"
              {...(cmp ? { trend: countTrend(kpis.activeProjects, cmp.activeProjects, suffix) } : {})}
            />
            <KpiCard
              label="Personas"
              value={String(kpis.people)}
              tone="indigo"
              {...(cmp ? { trend: countTrend(kpis.people, cmp.people, suffix) } : {})}
            />
          </KpiGrid>

          {/* Rankings */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <HorizontalBars title="Top clientes por ingresos" items={data.topClients} format={fmtEurShort} />
            <HorizontalBars title="Top personas por horas" items={data.topPeople} format={fmtHours} />
            <HorizontalBars title="Top proyectos por margen" items={data.topProjects} format={(v) => `${v.toFixed(1)}%`} />
          </SimpleGrid>

          {/* Líneas temporales */}
          <RevenueMarginTimeline
            points={data.timeline}
            {...(compare
              ? { comparePoints: compare.timeline, compareLabel: COMPARE_LABELS[compare.mode] }
              : {})}
          />

          {/* Donuts */}
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Donut title="Mix de áreas (horas)" slices={data.areaMix} format={fmtHours} />
            <Donut title="Mix de categorías (horas)" slices={data.categoryMix} format={fmtHours} />
          </SimpleGrid>

          {/* Heatmap */}
          <MarginHeatmap cells={data.heatmap} />

          <Group justify="flex-end">
            <Badge size="xs" variant="light" color="gray">
              {data.rowCount} celdas agregadas
            </Badge>
          </Group>
        </>
      )}
    </Stack>
  )
}
