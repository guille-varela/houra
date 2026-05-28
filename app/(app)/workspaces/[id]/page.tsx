import { notFound, redirect } from 'next/navigation'
import { desc, eq, sql } from 'drizzle-orm'
import { Stack, Text, Group, Card, SimpleGrid, Button } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { db } from '@/lib/db'
import {
  amendments,
  hourTransfers,
  persons,
  projects,
  reports,
  timeEntries,
  workspaces,
} from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import {
  buildMatrix,
  getProjectTotals,
  type Area,
  type Role,
  type ConsumedMap,
  type Allocation,
} from '@/lib/matrix'
import { buildMarginMatrix, computeEffectiveAllocation, getMarginTotals, formatEur } from '@/lib/margin'
import WorkspaceShareClient from './workspace-share-client'
import WorkspaceTabs from './workspace-tabs'

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
      return { id: p.id, name: p.name, status: p.status, totals, marginTotals }
    }),
  )

  const transferRows = await db
    .select({
      id: hourTransfers.id,
      fromProjectId: hourTransfers.fromProjectId,
      toProjectId: hourTransfers.toProjectId,
      area: hourTransfers.area,
      role: hourTransfers.role,
      hours: hourTransfers.hours,
      reason: hourTransfers.reason,
      performedAt: hourTransfers.performedAt,
      performedByName: persons.name,
    })
    .from(hourTransfers)
    .innerJoin(persons, eq(persons.id, hourTransfers.performedBy))
    .where(eq(hourTransfers.organizationId, workspace.organizationId))
    .orderBy(desc(hourTransfers.performedAt))

  const projectNameById = Object.fromEntries(projectRows.map((p) => [p.id, p.name]))

  const transfers = transferRows
    .filter((t) => projectNameById[t.fromProjectId] || projectNameById[t.toProjectId])
    .map((t) => ({
      id: t.id,
      fromProjectName: projectNameById[t.fromProjectId] ?? t.fromProjectId,
      toProjectName: projectNameById[t.toProjectId] ?? t.toProjectId,
      area: t.area,
      role: t.role,
      hours: t.hours,
      reason: t.reason,
      performedByName: t.performedByName ?? 'Sistema',
      performedAt: t.performedAt.toISOString(),
    }))

  const existingReports = await db
    .select({ id: reports.id, shareUrlSlug: reports.shareUrlSlug, status: reports.status, createdAt: reports.createdAt })
    .from(reports).where(eq(reports.scopeId, id)).orderBy(desc(reports.createdAt))

  const totalSold = projectData.reduce((s, p) => s + p.marginTotals.soldCents, 0)
  const totalHours = projectData.reduce((s, p) => s + p.totals.consumed, 0)

  return (
    <Stack p="md" gap="xl">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <div>
          <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {workspace.name}
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            {projectRows.length} proyecto{projectRows.length !== 1 ? 's' : ''}
          </Text>
        </div>
        <Group gap="xs" align="flex-start">
          <Group gap="xs">
            <Button
              component="a"
              href={`/api/export/workspace/${id}?format=csv`}
              download
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconDownload size={12} />}
            >
              CSV
            </Button>
            <Button
              component="a"
              href={`/api/export/workspace/${id}?format=xlsx`}
              download
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconDownload size={12} />}
            >
              Excel
            </Button>
          </Group>
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
      </Group>

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

      <WorkspaceTabs workspaceId={id} projects={projectData} transfers={transfers} />
    </Stack>
  )
}
