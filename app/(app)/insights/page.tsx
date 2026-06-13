import { redirect } from 'next/navigation'
import { Stack, Group, Text, Card, SimpleGrid, Badge } from '@mantine/core'
import { getCurrentPerson, canAccessInsights } from '@/lib/auth-helpers'
import { parseInsightsFilters } from '@/lib/insights-filters'
import { getInsights, getInsightsFilterOptions } from '@/lib/insights-data'
import InsightsFilterBar from '@/components/insights/insights-filter-bar'
import {
  KpiGrid,
  KpiCard,
  HorizontalBars,
  Donut,
  RevenueMarginTimeline,
  MarginHeatmap,
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

export default async function InsightsPage({ searchParams }: Props) {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  if (!canAccessInsights(person)) redirect('/today')

  const filters = parseInsightsFilters(await searchParams)
  const [options, data] = await Promise.all([
    getInsightsFilterOptions(person.organizationId),
    getInsights(person.organizationId, filters),
  ])

  const { kpis } = data

  return (
    <Stack p="md" gap="lg">
      <div>
        <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Insights</Text>
        <Text size="xs" c="dimmed">
          Inteligencia de negocio: sumatorios y comparativas con filtros combinables.
        </Text>
      </div>

      <InsightsFilterBar filters={filters} options={options} />

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
            <KpiCard label="Horas consumidas" value={fmtHours(kpis.hours)} tone="blue" />
            <KpiCard label="Ingresos" value={fmtEurShort(kpis.revenueCents)} tone="teal" />
            <KpiCard label="Coste" value={fmtEurShort(kpis.costCents)} tone="orange" />
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
            />
            <KpiCard label="Proyectos activos" value={String(kpis.activeProjects)} tone="grape" />
            <KpiCard label="Personas" value={String(kpis.people)} tone="indigo" />
          </KpiGrid>

          {/* Rankings */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <HorizontalBars title="Top clientes por ingresos" items={data.topClients} format={fmtEurShort} />
            <HorizontalBars title="Top personas por horas" items={data.topPeople} format={fmtHours} />
            <HorizontalBars title="Top proyectos por margen" items={data.topProjects} format={(v) => `${v.toFixed(1)}%`} />
          </SimpleGrid>

          {/* Líneas temporales */}
          <RevenueMarginTimeline points={data.timeline} />

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
