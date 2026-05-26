import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { Stack, SimpleGrid, Card, Text, Group } from '@mantine/core'
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
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Horas imputadas
          </Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }} mt={4}>
            {totals.hours.toFixed(1)}h
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Ingresos
          </Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }} mt={4}>
            {formatEur(totals.soldCents)}
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Coste
          </Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }} mt={4}>
            {formatEur(totals.costCents)}
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Margen
          </Text>
          <Group gap={6} align="baseline" mt={4}>
            <Text
              style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}
              c={totalColor}
            >
              {totals.marginPct !== null ? `${totals.marginPct.toFixed(1)}%` : 'n/d'}
            </Text>
            <Text size="xs" c="dimmed">{formatEur(totals.marginCents)}</Text>
          </Group>
        </Card>
      </SimpleGrid>

      <Stack gap="xs">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Margen por celda
        </Text>
        <MarginMatrix matrix={matrix} />
      </Stack>

      {amendmentRows.length > 0 && (
        <Text size="xs" c="dimmed">
          Asignación efectiva incluye {amendmentRows.length} amendment{amendmentRows.length > 1 ? 's' : ''}.
          Consulta la pestaña Amendments para ver el detalle.
        </Text>
      )}
    </Stack>
  )
}
