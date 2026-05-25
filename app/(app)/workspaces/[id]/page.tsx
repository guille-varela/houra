import { notFound, redirect } from 'next/navigation'
import { desc, eq, sql } from 'drizzle-orm'
import {
  Stack,
  Title,
  Text,
  Group,
  Badge,
  SimpleGrid,
  Paper,
  Anchor,
  Divider,
} from '@mantine/core'
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
import { marginColor } from '@/lib/tokens'
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

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1)

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

  // Fetch consumed hours + margin per project in parallel
  const projectData = await Promise.all(
    projectRows.map(async (p) => {
      const allocation = p.originalAllocation as Allocation

      const [consumedRows, amendmentRows, marginRows] = await Promise.all([
        db
          .select({
            area: timeEntries.area,
            role: persons.professionalCategory,
            hours: sql<string>`SUM(${timeEntries.hours})`,
          })
          .from(timeEntries)
          .innerJoin(persons, eq(persons.id, timeEntries.personId))
          .where(eq(timeEntries.projectId, p.id))
          .groupBy(timeEntries.area, persons.professionalCategory),
        db
          .select({ deltaAllocation: amendments.deltaAllocation })
          .from(amendments)
          .where(eq(amendments.projectId, p.id)),
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
          .where(eq(timeEntries.projectId, p.id))
          .groupBy(timeEntries.area, persons.professionalCategory),
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
        area: r.area,
        role: r.role,
        hours: parseFloat(r.hours),
        costCents: parseFloat(r.costCents),
        soldCents: parseFloat(r.soldCents),
      }))
      const marginMatrix = buildMarginMatrix(parsedMarginRows)
      const marginTotals = getMarginTotals(marginMatrix)

      return { ...p, totals, marginTotals }
    }),
  )

  const existingReports = await db
    .select({
      id: reports.id,
      shareUrlSlug: reports.shareUrlSlug,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.scopeId, id))
    .orderBy(desc(reports.createdAt))

  return (
    <Stack p="md" gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{workspace.name}</Title>
          <Text size="xs" c="dimmed">{projectRows.length} proyecto{projectRows.length !== 1 ? 's' : ''}</Text>
        </div>
        <WorkspaceShareClient workspaceId={id} existingReports={existingReports.map(r => ({
          id: r.id,
          slug: r.shareUrlSlug,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }))} />
      </Group>

      <Divider />

      {/* Projects table */}
      <Stack gap="sm">
        {projectData.map((p) => {
          const mColor = marginColor(p.marginTotals.marginPct ?? -1)
          return (
            <Paper key={p.id} withBorder p="md" radius="sm">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Anchor component={Link} href={`/projects/${p.id}`} fw={600} size="sm">
                      {p.name}
                    </Anchor>
                    <Badge size="xs" color={STATUS_COLOR[p.status] ?? 'gray'} variant="light">
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {p.totals.consumed.toFixed(1)}h consumidas
                    {p.totals.planned > 0
                      ? ` / ${p.totals.planned.toFixed(0)}h planificadas`
                      : ''}
                    {p.totals.pct !== null ? ` — ${Math.round(p.totals.pct)}%` : ''}
                  </Text>
                </div>
                <SimpleGrid cols={2} spacing="xs">
                  <Paper withBorder p="xs" radius="sm">
                    <Text size="xs" c="dimmed">Ingresos</Text>
                    <Text size="sm" fw={600}>{formatEur(p.marginTotals.soldCents)}</Text>
                  </Paper>
                  <Paper withBorder p="xs" radius="sm">
                    <Text size="xs" c="dimmed">Margen</Text>
                    <Text size="sm" fw={600} c={mColor}>
                      {p.marginTotals.marginPct !== null
                        ? `${p.marginTotals.marginPct.toFixed(1)}%`
                        : '—'}
                    </Text>
                  </Paper>
                </SimpleGrid>
              </Group>
            </Paper>
          )
        })}

        {projectData.length === 0 && (
          <Text size="sm" c="dimmed">Sin proyectos en este workspace todavía.</Text>
        )}
      </Stack>
    </Stack>
  )
}
