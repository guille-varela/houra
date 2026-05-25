import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { Stack, SimpleGrid, Paper, Text, Group, Title } from '@mantine/core'
import { db } from '@/lib/db'
import { amendments, persons, timeEntries } from '@/db/schema'
import { buildMarginMatrix, computeEffectiveAllocation, getMarginTotals, formatEur } from '@/lib/margin'
import { marginColor } from '@/lib/tokens'
import MarginMatrix from '@/components/projects/margin-matrix'
import { type Allocation } from '@/lib/matrix'

type Props = {
  projectId: string
  originalAllocation: Allocation
}

export default async function MarginTab({ projectId, originalAllocation }: Props) {
  const [marginRows, amendmentRows] = await Promise.all([
    db
      .select({
        area: timeEntries.area,
        role: persons.professionalCategory,
        hours: sql<string>`SUM(${timeEntries.hours}::numeric)`,
        costCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.costRateAtEntryCents})`,
        soldCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.soldRateAtEntryCents})`,
      })
      .from(timeEntries)
      .innerJoin(persons, eq(persons.id, timeEntries.personId))
      .where(eq(timeEntries.projectId, projectId))
      .groupBy(timeEntries.area, persons.professionalCategory),
    db
      .select({ deltaAllocation: amendments.deltaAllocation })
      .from(amendments)
      .where(eq(amendments.projectId, projectId)),
  ])

  const effectiveAllocation = computeEffectiveAllocation(
    originalAllocation,
    amendmentRows as Array<{ deltaAllocation: Record<string, Record<string, number>> }>,
  )

  const rows = marginRows.map((r) => ({
    area: r.area,
    role: r.role,
    hours: parseFloat(r.hours),
    costCents: parseFloat(r.costCents),
    soldCents: parseFloat(r.soldCents),
  }))

  const matrix = buildMarginMatrix(rows)
  const totals = getMarginTotals(matrix)

  if (totals.hours === 0) {
    return (
      <Text size="sm" c="dimmed">
        Sin horas imputadas — el margen se calculará cuando haya entradas de tiempo.
      </Text>
    )
  }

  const totalColor = marginColor(totals.marginPct ?? -1)

  return (
    <Stack gap="md">
      {/* Summary cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Horas imputadas</Text>
          <Text size="lg" fw={700}>{totals.hours.toFixed(1)}h</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Ingresos</Text>
          <Text size="lg" fw={700}>{formatEur(totals.soldCents)}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Coste</Text>
          <Text size="lg" fw={700}>{formatEur(totals.costCents)}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Margen</Text>
          <Group gap={6} align="baseline">
            <Text size="lg" fw={700} c={totalColor}>
              {totals.marginPct !== null ? `${totals.marginPct.toFixed(1)}%` : 'n/d'}
            </Text>
            <Text size="xs" c="dimmed">{formatEur(totals.marginCents)}</Text>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Per-cell matrix */}
      <Stack gap="xs">
        <Title order={6} c="dimmed">Margen por celda</Title>
        <MarginMatrix matrix={matrix} />
      </Stack>

      {/* Effective allocation reminder */}
      {amendmentRows.length > 0 && (
        <Text size="xs" c="dimmed">
          Asignación efectiva incluye {amendmentRows.length} amendment{amendmentRows.length > 1 ? 's' : ''}.
          Consulta la pestaña Amendments para ver el detalle.
        </Text>
      )}
    </Stack>
  )
}
