import { notFound, redirect } from 'next/navigation'
import { desc, eq, sql } from 'drizzle-orm'
import { Stack, Text, Group, Badge, Card, SimpleGrid, Anchor } from '@mantine/core'
import Link from 'next/link'
import { db } from '@/lib/db'
import { amendments, persons, projects, reports, timeEntries, workspaces } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import {
  buildMatrix,
  getProjectTotals,
  type Area,
  type Role,
  type ConsumedMap,
  type Allocation,
} from '@/lib/matrix'
import {
  buildMarginMatrix,
  computeEffectiveAllocation,
  getMarginTotals,
  formatEur,
} from '@/lib/margin'
import { marginColor, consumptionColor } from '@/lib/tokens'
import WorkspaceShareClient from './workspace-share-client'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  active: 'green',
  paused: 'yellow',
  closed: 'red',
}

type Props = { params: Promise<{ id: string }> }

export default async function WorkspacePage({ params }: Props) {
  const { id } = await params

  let person: Awaited<ReturnType<typeof requireRole>>
  try {
    person = await requireRole('manager')
  } catch {
    redirect('/today')
  }

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  if (!workspace) notFound()

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      originalAllocation: projects.originalAllocation,
    })
    .from(projects)
    .where(eq(projects.workspaceId, id))
    .orderBy(projects.status, projects.name)

  const projectData = await Promise.all(
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
      const matrix = buildMatrix(effectiveAllocation, consumed)
      const totals = getProjectTotals(matrix)
      const parsedMarginRows = marginRows.map((r) => ({
        area: r.area, role: r.role, hours: parseFloat(r.hours),
        costCents: parseFloat(r.costCents), soldCents: parseFloat(r.soldCents),
      }))
      const marginTotals = getMarginTotals(buildMarginMatrix(parsedMarginRows))
      return { ...p, totals, marginTotals }
    }),
  )

  const existingReports = await db
    .select({ id: reports.id, shareUrlSlug: reports.shareUrlSlug, status: reports.status, createdAt: reports.createdAt })
    .from(reports).where(eq(reports.scopeId, id)).orderBy(desc(reports.createdAt))

  const totalSold = projectData.reduce((s, p) => s + p.marginTotals.soldCents, 0)
  const totalHours = projectData.reduce((s, p) => s + p.totals.consumed, 0)

  return (
    <Stack p="md" gap="xl">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {workspace.name}
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            {projectRows.length} proyecto{projectRows.length !== 1 ? 's' : ''}
          </Text>
        </div>
        <WorkspaceShareClient
          workspaceId={id}
          existingReports={existingReports.map((r) => ({
            id: r.id,
            slug: r.shareUrlSlug,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
          }))}
        />
      </Group>

      {/* KPI row */}
      <SimpleGrid cols={2} spacing="sm">
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Horas</Text>
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
      </SimpleGrid>

      {/* Project list */}
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Proyectos
        </Text>
        {projectData.length === 0 && (
          <Card><Text size="sm" c="dimmed" ta="center" py="lg">Sin proyectos en este workspace.</Text></Card>
        )}
        {projectData.map((p) => {
          const mColor = marginColor(p.marginTotals.marginPct ?? -1)
          const cColor = consumptionColor(p.totals.pct)
          return (
            <Card key={p.id} p="md">
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" mb={4}>
                    <Anchor component={Link} href={`/projects/${p.id}`} fw={600} size="sm" c="dark">
                      {p.name}
                    </Anchor>
                    <Badge size="xs" color={STATUS_COLOR[p.status] ?? 'gray'} variant="light" radius="sm">
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    <Text span c={cColor} fw={500} size="xs">
                      {p.totals.consumed.toFixed(1)}h
                    </Text>
                    {p.totals.planned > 0 ? ` / ${p.totals.planned.toFixed(0)}h` : ''}
                    {p.totals.pct !== null ? ` · ${Math.round(p.totals.pct)}%` : ''}
                  </Text>
                </div>
                <Group gap="xl">
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
    </Stack>
  )
}
