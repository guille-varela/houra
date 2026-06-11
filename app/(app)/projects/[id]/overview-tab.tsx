import { eq, sql } from 'drizzle-orm'
import { Stack, Text, Group, Card, SimpleGrid } from '@mantine/core'
import { db } from '@/lib/db'
import { persons, timeEntries } from '@/db/schema'
import {
  buildMatrix,
  getProjectTotals,
  getProjectedEndDate,
  type Area,
  type Role,
  type ConsumedMap,
} from '@/lib/matrix'
import { consumptionColor } from '@/lib/tokens'
import AllocationMatrix from '@/components/projects/allocation-matrix'
import BurnRateChart from '@/components/projects/burn-rate-chart'

type Props = {
  projectId: string
  allocation: Record<string, Record<string, number>>
  projectType: string
  startDate: string | null
  endDate: string | null
}

export default async function OverviewTab({
  projectId,
  allocation,
  projectType,
  startDate,
  endDate,
}: Props) {
  const consumedRows = await db
    .select({
      area: timeEntries.area,
      role: persons.professionalCategory,
      hours: sql<string>`SUM(${timeEntries.hours})`,
    })
    .from(timeEntries)
    .innerJoin(persons, eq(persons.id, timeEntries.personId))
    .where(eq(timeEntries.projectId, projectId))
    .groupBy(timeEntries.area, persons.professionalCategory)

  const consumed: ConsumedMap = {}
  for (const row of consumedRows) {
    const area = row.area as Area
    const role = row.role as Role
    if (!consumed[area]) consumed[area] = {}
    consumed[area]![role] = parseFloat(row.hours)
  }

  const matrix = buildMatrix(allocation, consumed)
  const totals = getProjectTotals(matrix)

  const weekRows = await db
    .select({
      week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${timeEntries.date}::date), 'YYYY-MM-DD')`,
      hours: sql<string>`SUM(${timeEntries.hours})`,
    })
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId))
    .groupBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`)
    .orderBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`)

  const burnData = weekRows.reduce<{ week: string; hours: number; cumulative: number }[]>(
    (acc, r) => {
      const hours = parseFloat(r.hours)
      const cumulative = (acc[acc.length - 1]?.cumulative ?? 0) + hours
      acc.push({ week: r.week, hours, cumulative })
      return acc
    },
    [],
  )

  const contributorRows = await db
    .select({
      name: persons.name,
      hours: sql<string>`SUM(${timeEntries.hours})`,
    })
    .from(timeEntries)
    .innerJoin(persons, eq(persons.id, timeEntries.personId))
    .where(eq(timeEntries.projectId, projectId))
    .groupBy(persons.name)
    .orderBy(sql`SUM(${timeEntries.hours}) DESC`)
    .limit(5)

  const isBag = projectType === 'fixed_bag' || projectType === 'renewable_bag'
  const projectedEnd = isBag
    ? getProjectedEndDate(totals.planned, totals.consumed, startDate)
    : null

  const pctColor = consumptionColor(totals.pct)

  return (
    <Stack gap="xl">
      {/* KPI row */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Planificado
          </Text>
          <Text
            style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}
          >
            {totals.planned.toFixed(0)}h
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Consumido
          </Text>
          <Text
            style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}
            c={pctColor}
          >
            {totals.consumed.toFixed(1)}h
          </Text>
          {totals.pct !== null && (
            <Text size="xs" c="dimmed" mt={2}>{Math.round(totals.pct)}%</Text>
          )}
        </Card>
        {projectedEnd && (
          <Card p="md">
            <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
              Fin proyectado
            </Text>
            <Text fw={600} size="sm" mt={4}>{projectedEnd}</Text>
            {endDate && projectedEnd > endDate && (
              <Text size="xs" c="red" mt={2}>supera fecha fin</Text>
            )}
          </Card>
        )}
      </SimpleGrid>

      {/* Matrix */}
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Área × rol
        </Text>
        <Text size="xs" c="dimmed">Haz clic en una celda para ver las entradas detalladas.</Text>
        <AllocationMatrix matrix={matrix} projectId={projectId} />
      </Stack>

      {/* Burn rate */}
      {burnData.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Burn rate
          </Text>
          <Card p="md">
            <BurnRateChart data={burnData} />
          </Card>
        </Stack>
      )}

      {/* Contributors */}
      {contributorRows.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Colaboradores
          </Text>
          <Card p="md">
            <Stack gap="sm">
              {contributorRows.map((c) => (
                <Group key={c.name} justify="space-between">
                  <Text size="sm">{c.name}</Text>
                  <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {parseFloat(c.hours).toFixed(1)}h
                  </Text>
                </Group>
              ))}
            </Stack>
          </Card>
        </Stack>
      )}

      {totals.consumed === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Sin entradas registradas en este proyecto todavía.
        </Text>
      )}
    </Stack>
  )
}
