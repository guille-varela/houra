import { redirect } from 'next/navigation'
import { eq, sql } from 'drizzle-orm'
import { Stack, Text, Card, Group, Badge, SimpleGrid } from '@mantine/core'
import { AnchorLink } from '@/components/ui/anchor-link'
import { db } from '@/lib/db'
import { amendments, persons, projects, timeEntries, workspaces } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import {
  buildMatrix,
  getProjectTotals,
  getProjectedEndDate,
  type Area,
  type Role,
  type ConsumedMap,
  type Allocation,
} from '@/lib/matrix'
import { buildMarginMatrix, computeEffectiveAllocation, getMarginTotals, formatEur } from '@/lib/margin'
import { consumptionColor, marginColor } from '@/lib/tokens'

export default async function DashboardPage() {
  let person: Awaited<ReturnType<typeof requireRole>>
  try {
    person = await requireRole('manager')
  } catch {
    redirect('/today')
  }

  const workspaceRows = await db
    .select({ id: workspaces.id, name: workspaces.name, status: workspaces.status })
    .from(workspaces)
    .where(eq(workspaces.organizationId, person.organizationId))
    .orderBy(workspaces.name)

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      workspaceId: projects.workspaceId,
      originalAllocation: projects.originalAllocation,
      startDate: projects.startDate,
      endDate: projects.endDate,
      weeklyHours: projects.weeklyHours,
    })
    .from(projects)
    .where(eq(projects.organizationId, person.organizationId))
    .orderBy(projects.workspaceId, projects.status, projects.name)

  const enriched = await Promise.all(
    projectRows.map(async (p) => {
      const allocation = p.originalAllocation as Allocation
      const [consumedRows, amendmentRows, marginRows] = await Promise.all([
        db.select({ area: timeEntries.area, role: persons.professionalCategory, hours: sql<string>`SUM(${timeEntries.hours})` })
          .from(timeEntries).innerJoin(persons, eq(persons.id, timeEntries.personId))
          .where(eq(timeEntries.projectId, p.id)).groupBy(timeEntries.area, persons.professionalCategory),
        db.select({ deltaAllocation: amendments.deltaAllocation })
          .from(amendments).where(eq(amendments.projectId, p.id)),
        db.select({
          area: timeEntries.area, role: persons.professionalCategory,
          hours: sql<string>`SUM(${timeEntries.hours}::numeric)`,
          costCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.costRateAtEntryCents})`,
          soldCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.soldRateAtEntryCents})`,
        }).from(timeEntries).innerJoin(persons, eq(persons.id, timeEntries.personId))
          .where(eq(timeEntries.projectId, p.id)).groupBy(timeEntries.area, persons.professionalCategory),
      ])

      const consumed: ConsumedMap = {}
      for (const r of consumedRows) {
        const area = r.area as Area
        const role = r.role as Role
        if (!consumed[area]) consumed[area] = {}
        consumed[area]![role] = parseFloat(r.hours)
      }

      const effectiveAllocation = computeEffectiveAllocation(
        allocation,
        amendmentRows as Array<{ deltaAllocation: Record<string, Record<string, number>> }>,
      )
      const isBag = p.type === 'fixed_bag' || p.type === 'renewable_bag'
      const matrix = buildMatrix(effectiveAllocation, consumed)
      const totals = getProjectTotals(matrix)
      const projectedEnd = isBag
        ? getProjectedEndDate(totals.planned, totals.consumed, p.startDate)
        : null

      const parsedMarginRows = marginRows.map((r) => ({
        area: r.area, role: r.role, hours: parseFloat(r.hours),
        costCents: parseFloat(r.costCents), soldCents: parseFloat(r.soldCents),
      }))
      const marginTotals = getMarginTotals(buildMarginMatrix(parsedMarginRows))

      return { ...p, totals, marginTotals, projectedEnd }
    }),
  )

  const projectsByWorkspace = workspaceRows.map((w) => ({
    ...w,
    projects: enriched.filter((p) => p.workspaceId === w.id),
  }))

  const totalHours = enriched.reduce((s, p) => s + p.totals.consumed, 0)
  const totalSold = enriched.reduce((s, p) => s + p.marginTotals.soldCents, 0)
  const activeProjects = enriched.filter((p) => p.status === 'active').length

  const STATUS_LABELS: Record<string, string> = {
    draft: 'Borrador', active: 'Activo', paused: 'Pausado', closed: 'Cerrado',
  }
  const STATUS_COLOR: Record<string, string> = {
    draft: 'gray', active: 'green', paused: 'yellow', closed: 'red',
  }

  return (
    <Stack p="md" gap="xl">
      <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
        Dashboard global
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Horas totales</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {totalHours.toFixed(1)}h
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Ingresos</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {formatEur(totalSold)}
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Proyectos activos</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {activeProjects}
          </Text>
        </Card>
      </SimpleGrid>

      <Stack gap="xl">
        {projectsByWorkspace.map((w) => (
          <Stack key={w.id} gap="sm">
            <Group gap="xs">
              <AnchorLink href={`/workspaces/${w.id}`} size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
                {w.name}
              </AnchorLink>
              <Text size="xs" c="dimmed">— {w.projects.length} proyecto{w.projects.length !== 1 ? 's' : ''}</Text>
            </Group>
            {w.projects.length === 0 && (
              <Card><Text size="sm" c="dimmed" py="xs">Sin proyectos.</Text></Card>
            )}
            {w.projects.map((p) => {
              const cColor = consumptionColor(p.totals.pct)
              const mColor = marginColor(p.marginTotals.marginPct ?? -1)
              return (
                <Card key={p.id} p="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" mb={4}>
                        <AnchorLink href={`/projects/${p.id}`} fw={600} size="sm" c="dark">
                          {p.name}
                        </AnchorLink>
                        <Badge size="xs" color={STATUS_COLOR[p.status] ?? 'gray'} variant="light">
                          {STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </Group>
                      <Group gap="lg">
                        <Text size="xs" c="dimmed">
                          <Text span c={cColor} fw={600} size="xs">
                            {p.totals.consumed.toFixed(1)}h
                          </Text>
                          {p.totals.planned > 0 ? ` / ${p.totals.planned.toFixed(0)}h` : ''}
                          {p.totals.pct !== null ? ` · ${Math.round(p.totals.pct)}%` : ''}
                        </Text>
                        {p.projectedEnd && (
                          <Text size="xs" c="dimmed">Fin proyectado: {p.projectedEnd}</Text>
                        )}
                      </Group>
                    </div>
                    <Group gap="xl" style={{ flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="xs" c="dimmed">Ingresos</Text>
                        <Text size="sm" fw={600}>{formatEur(p.marginTotals.soldCents)}</Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="xs" c="dimmed">Margen</Text>
                        <Text size="sm" fw={600} c={mColor}>
                          {p.marginTotals.marginPct !== null ? `${p.marginTotals.marginPct.toFixed(1)}%` : '—'}
                        </Text>
                      </div>
                    </Group>
                  </Group>
                </Card>
              )
            })}
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}
