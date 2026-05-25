import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { Stack, Title, Group, Text, Badge, Card, SimpleGrid, Divider } from '@mantine/core'
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
import AllocationMatrix from '@/components/projects/allocation-matrix'
import BurnRateChart from '@/components/projects/burn-rate-chart'

const STATUS_COLOR: Record<string, string> = {
  green: 'green',
  orange: 'orange',
  red: 'red',
  empty: 'gray',
}

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
  // 1. Matrix consumption: area × professional_category
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

  // 2. Burn rate by ISO week
  const weekRows = await db
    .select({
      week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${timeEntries.date}::date), 'YYYY-MM-DD')`,
      hours: sql<string>`SUM(${timeEntries.hours})`,
    })
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId))
    .groupBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`)
    .orderBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`)

  let cumulative = 0
  const burnData = weekRows.map((r) => {
    cumulative += parseFloat(r.hours)
    return { week: r.week, hours: parseFloat(r.hours), cumulative }
  })

  // 3. Top contributors
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

  // 4. Projected end
  const isBag = projectType === 'fixed_bag' || projectType === 'renewable_bag'
  const projectedEnd = isBag
    ? getProjectedEndDate(totals.planned, totals.consumed, startDate)
    : null

  return (
    <Stack gap="lg">
      {/* Summary */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">
            Planificado
          </Text>
          <Text fw={600}>{totals.planned.toFixed(0)}h</Text>
        </Card>
        <Card withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">
            Consumido
          </Text>
          <Text fw={600}>{totals.consumed.toFixed(1)}h</Text>
        </Card>
        <Card withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">
            % total
          </Text>
          <Badge
            color={(STATUS_COLOR[totals.color] ?? 'gray') as string}
            variant="light"
            size="lg"
            style={{ fontWeight: 600 }}
          >
            {totals.pct !== null ? `${Math.round(totals.pct)}%` : '—'}
          </Badge>
        </Card>
        {projectedEnd && (
          <Card withBorder p="sm" radius="sm">
            <Text size="xs" c="dimmed">
              Fin proyectado
            </Text>
            <Text fw={600} size="sm">
              {projectedEnd}
            </Text>
            {endDate && projectedEnd > endDate && (
              <Text size="xs" c="red" mt={2}>
                supera fecha fin
              </Text>
            )}
          </Card>
        )}
      </SimpleGrid>

      {/* Matrix */}
      <Stack gap="xs">
        <Title order={5}>Matriz área × rol</Title>
        <Text size="xs" c="dimmed">
          Haz clic en una celda para ver las entradas detalladas.
        </Text>
        <AllocationMatrix matrix={matrix} projectId={projectId} />
      </Stack>

      {/* Burn rate */}
      <Stack gap="xs">
        <Title order={5}>Burn rate</Title>
        <BurnRateChart data={burnData} />
      </Stack>

      {/* Top contributors */}
      {contributorRows.length > 0 && (
        <Stack gap="xs">
          <Title order={5}>Top colaboradores</Title>
          {contributorRows.map((c) => (
            <Group key={c.name} justify="space-between">
              <Text size="sm">{c.name}</Text>
              <Text size="sm" c="dimmed">
                {parseFloat(c.hours).toFixed(1)}h
              </Text>
            </Group>
          ))}
        </Stack>
      )}

      {totals.consumed === 0 && (
        <>
          <Divider />
          <Text size="sm" c="dimmed" ta="center">
            Sin entradas registradas en este proyecto todavía.
          </Text>
        </>
      )}
    </Stack>
  )
}
