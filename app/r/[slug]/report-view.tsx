import { eq, sql } from 'drizzle-orm'
import { Stack, Title, Text, Group, Badge, SimpleGrid, Paper, Divider } from '@mantine/core'
import { db } from '@/lib/db'
import { amendments, persons, projects, timeEntries, workspaces } from '@/db/schema'
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
import { consumptionColor, marginColor } from '@/lib/tokens'
import AllocationMatrix from '@/components/projects/allocation-matrix'
import MarginMatrix from '@/components/projects/margin-matrix'
import BurnRateChart from '@/components/projects/burn-rate-chart'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', active: 'Activo', paused: 'Pausado', closed: 'Cerrado',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'gray', active: 'green', paused: 'yellow', closed: 'red',
}

async function ProjectView({ projectId }: { projectId: string }) {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      originalAllocation: projects.originalAllocation,
      workspaceName: workspaces.name,
    })
    .from(projects)
    .leftJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) return <Text c="dimmed">Proyecto no encontrado.</Text>

  const allocation = project.originalAllocation as Allocation

  const [consumedRows, amendmentRows, weekRows, contributorRows, marginRows] = await Promise.all([
    db.select({ area: timeEntries.area, role: persons.professionalCategory, hours: sql<string>`SUM(${timeEntries.hours})` })
      .from(timeEntries).innerJoin(persons, eq(persons.id, timeEntries.personId))
      .where(eq(timeEntries.projectId, projectId)).groupBy(timeEntries.area, persons.professionalCategory),
    db.select({ deltaAllocation: amendments.deltaAllocation })
      .from(amendments).where(eq(amendments.projectId, projectId)),
    db.select({
        week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${timeEntries.date}::date), 'YYYY-MM-DD')`,
        hours: sql<string>`SUM(${timeEntries.hours})`,
      }).from(timeEntries).where(eq(timeEntries.projectId, projectId))
      .groupBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`)
      .orderBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`),
    db.select({ name: persons.name, hours: sql<string>`SUM(${timeEntries.hours})` })
      .from(timeEntries).innerJoin(persons, eq(persons.id, timeEntries.personId))
      .where(eq(timeEntries.projectId, projectId)).groupBy(persons.name)
      .orderBy(sql`SUM(${timeEntries.hours}) DESC`).limit(5),
    db.select({
        area: timeEntries.area, role: persons.professionalCategory,
        hours: sql<string>`SUM(${timeEntries.hours}::numeric)`,
        costCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.costRateAtEntryCents})`,
        soldCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.soldRateAtEntryCents})`,
      }).from(timeEntries).innerJoin(persons, eq(persons.id, timeEntries.personId))
      .where(eq(timeEntries.projectId, projectId)).groupBy(timeEntries.area, persons.professionalCategory),
  ])

  const consumed: ConsumedMap = {}
  for (const r of consumedRows) {
    const area = r.area as Area; const role = r.role as Role
    if (!consumed[area]) consumed[area] = {}
    consumed[area]![role] = parseFloat(r.hours)
  }

  const effectiveAllocation = computeEffectiveAllocation(
    allocation,
    amendmentRows as Array<{ deltaAllocation: Record<string, Record<string, number>> }>,
  )
  const matrix = buildMatrix(effectiveAllocation, consumed)
  const totals = getProjectTotals(matrix)

  const burnData = weekRows.reduce<{ week: string; hours: number; cumulative: number }[]>(
    (acc, r) => {
      const hours = parseFloat(r.hours)
      const cumulative = (acc[acc.length - 1]?.cumulative ?? 0) + hours
      acc.push({ week: r.week as string, hours, cumulative })
      return acc
    },
    [],
  )

  const parsedMarginRows = marginRows.map((r) => ({
    area: r.area, role: r.role, hours: parseFloat(r.hours),
    costCents: parseFloat(r.costCents), soldCents: parseFloat(r.soldCents),
  }))
  const marginMatrix = buildMarginMatrix(parsedMarginRows)
  const marginTotals = getMarginTotals(marginMatrix)
  const mColor = marginColor(marginTotals.marginPct ?? -1)
  const cColor = consumptionColor(totals.pct)

  return (
    <Stack gap="lg">
      <div>
        <Group gap="xs" mb={4}>
          <Title order={3}>{project.name}</Title>
          <Badge color={STATUS_COLOR[project.status] ?? 'gray'} variant="light">
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
        </Group>
        {project.workspaceName && <Text size="xs" c="dimmed">{project.workspaceName}</Text>}
        {project.startDate && (
          <Text size="xs" c="dimmed">
            {project.startDate}{project.endDate ? ` → ${project.endDate}` : ''}
          </Text>
        )}
      </div>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Planificado</Text>
          <Text fw={600}>{totals.planned.toFixed(0)}h</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Consumido</Text>
          <Text fw={600} c={cColor}>{totals.consumed.toFixed(1)}h ({totals.pct !== null ? `${Math.round(totals.pct)}%` : '—'})</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Ingresos</Text>
          <Text fw={600}>{formatEur(marginTotals.soldCents)}</Text>
        </Paper>
        <Paper withBorder p="sm" radius="sm">
          <Text size="xs" c="dimmed">Margen</Text>
          <Text fw={600} c={mColor}>
            {marginTotals.marginPct !== null ? `${marginTotals.marginPct.toFixed(1)}%` : '—'}
          </Text>
        </Paper>
      </SimpleGrid>

      <Stack gap="xs">
        <Title order={5}>Consumo área × rol</Title>
        <AllocationMatrix matrix={matrix} projectId={projectId} />
      </Stack>

      <Stack gap="xs">
        <Title order={5}>Margen área × rol</Title>
        <MarginMatrix matrix={marginMatrix} />
      </Stack>

      {burnData.length > 0 && (
        <Stack gap="xs">
          <Title order={5}>Burn rate</Title>
          <BurnRateChart data={burnData} />
        </Stack>
      )}

      {contributorRows.length > 0 && (
        <Stack gap="xs">
          <Title order={5}>Colaboradores</Title>
          {contributorRows.map((c) => (
            <Group key={c.name} justify="space-between">
              <Text size="sm">{c.name}</Text>
              <Text size="sm" c="dimmed">{parseFloat(c.hours).toFixed(1)}h</Text>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

async function WorkspaceView({ workspaceId }: { workspaceId: string }) {
  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1)

  if (!workspace) return <Text c="dimmed">Workspace no encontrado.</Text>

  const projectRows = await db
    .select({ id: projects.id, name: projects.name, type: projects.type, status: projects.status, originalAllocation: projects.originalAllocation })
    .from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(projects.status, projects.name)

  const projectData = await Promise.all(projectRows.map(async (p) => {
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
      const area = r.area as Area; const role = r.role as Role
      if (!consumed[area]) consumed[area] = {}
      consumed[area]![role] = parseFloat(r.hours)
    }
    const effectiveAllocation = computeEffectiveAllocation(allocation, amendmentRows as Array<{ deltaAllocation: Record<string, Record<string, number>> }>)
    const matrix = buildMatrix(effectiveAllocation, consumed)
    const totals = getProjectTotals(matrix)
    const parsedMarginRows = marginRows.map(r => ({ area: r.area, role: r.role, hours: parseFloat(r.hours), costCents: parseFloat(r.costCents), soldCents: parseFloat(r.soldCents) }))
    const marginTotals = getMarginTotals(buildMarginMatrix(parsedMarginRows))
    return { ...p, totals, marginTotals }
  }))

  return (
    <Stack gap="lg">
      <Title order={3}>{workspace.name}</Title>
      <Stack gap="sm">
        {projectData.map((p) => {
          const mColor = marginColor(p.marginTotals.marginPct ?? -1)
          return (
            <Paper key={p.id} withBorder p="md" radius="sm">
              <Group justify="space-between">
                <div>
                  <Text fw={600} size="sm">{p.name}</Text>
                  <Text size="xs" c="dimmed">
                    {p.totals.consumed.toFixed(1)}h{p.totals.planned > 0 ? ` / ${p.totals.planned.toFixed(0)}h` : ''}{p.totals.pct !== null ? ` — ${Math.round(p.totals.pct)}%` : ''}
                  </Text>
                </div>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">{formatEur(p.marginTotals.soldCents)}</Text>
                  <Text size="sm" fw={600} c={mColor}>
                    {p.marginTotals.marginPct !== null ? `${p.marginTotals.marginPct.toFixed(1)}%` : '—'}
                  </Text>
                </Group>
              </Group>
            </Paper>
          )
        })}
      </Stack>
    </Stack>
  )
}

type ReportViewProps = {
  scope: string
  scopeId: string
  generatedAt: string
}

export default async function ReportView({ scope, scopeId, generatedAt }: ReportViewProps) {
  return (
    <Stack gap="xl">
      {scope === 'project' && <ProjectView projectId={scopeId} />}
      {scope === 'workspace' && <WorkspaceView workspaceId={scopeId} />}
      <Divider />
      <Text size="xs" c="dimmed" ta="center">
        Generado el {new Date(generatedAt).toLocaleString('es-ES')} · Houra
      </Text>
    </Stack>
  )
}
