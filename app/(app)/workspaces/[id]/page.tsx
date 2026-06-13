import { notFound, redirect } from 'next/navigation'
import { desc, eq, sql, inArray } from 'drizzle-orm'
import { Stack, Text, Group, Card, SimpleGrid, Button, Badge } from '@mantine/core'
import { IconDownload, IconShieldCheck } from '@tabler/icons-react'
import { AnchorLink } from '@/components/ui/anchor-link'
import { db } from '@/lib/db'
import {
  amendments,
  clients,
  hourTransfers,
  persons,
  projects,
  reports,
  timeEntries,
  workspaces,
} from '@/db/schema'
import { MonthlyRevenueChart, EffortDistribution } from '@/components/workspace/account-charts'
import { marginColor } from '@/lib/tokens'
import { formatDateEU } from '@/lib/dates'
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
      clientId: projects.clientId,
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
      return { id: p.id, name: p.name, type: p.type, status: p.status, totals, marginTotals }
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

  // ── KPIs agregados de la cuenta ──
  const totalSold = projectData.reduce((s, p) => s + p.marginTotals.soldCents, 0)
  const totalHours = projectData.reduce((s, p) => s + p.totals.consumed, 0)
  const totalPlanned = projectData.reduce((s, p) => s + p.totals.planned, 0)
  const totalMarginCents = projectData.reduce((s, p) => s + p.marginTotals.marginCents, 0)
  const weightedMargin = totalSold > 0 ? (totalMarginCents / totalSold) * 100 : null

  // ── Evolución de ingresos (últimos 12 meses) ──
  const projectIds = projectRows.map((p) => p.id)
  const monthlyRaw = projectIds.length > 0
    ? await db
        .select({
          ym: sql<string>`to_char(date_trunc('month', ${timeEntries.date}::date), 'YYYY-MM')`,
          soldCents: sql<string>`COALESCE(SUM(${timeEntries.hours}::numeric * ${timeEntries.soldRateAtEntryCents}), 0)`,
        })
        .from(timeEntries)
        .where(inArray(timeEntries.projectId, projectIds))
        .groupBy(sql`date_trunc('month', ${timeEntries.date}::date)`)
    : []
  const monthlyMap = new Map(monthlyRaw.map((r) => [r.ym, Math.round(parseFloat(r.soldCents))]))
  const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const now = new Date()
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { label: MONTHS_ES[d.getMonth()]!, revenueCents: monthlyMap.get(ym) ?? 0 }
  })

  // ── Acuerdo marco (si todos los proyectos son de un único cliente con marco) ──
  const distinctClientIds = [...new Set(projectRows.map((p) => p.clientId).filter((x): x is string => !!x))]
  let marcoClient: { id: string; name: string; start: string | null; end: string | null } | null = null
  if (distinctClientIds.length === 1) {
    const [c] = await db
      .select({
        id: clients.id, name: clients.name, hasMarco: clients.hasMarco,
        start: clients.marcoStartDate, end: clients.marcoEndDate,
      })
      .from(clients)
      .where(eq(clients.id, distinctClientIds[0]!))
      .limit(1)
    if (c?.hasMarco) marcoClient = { id: c.id, name: c.name, start: c.start, end: c.end }
  }

  // ── Sugerencia de transferencia cross-proyecto (proyectos activos) ──
  const activeProjects = projectData.filter((p) => p.status === 'active')
  const surplus = activeProjects
    .map((p) => ({ p, free: p.totals.planned - p.totals.consumed }))
    .filter((x) => x.free > 0)
    .sort((a, b) => b.free - a.free)
  const deficit = activeProjects
    .map((p) => ({ p, over: p.totals.consumed - p.totals.planned }))
    .filter((x) => x.over > 0)
    .sort((a, b) => b.over - a.over)
  const transferSuggestion =
    surplus.length > 0 && deficit.length > 0 && surplus[0]!.p.id !== deficit[0]!.p.id
      ? {
          fromProjectId: surplus[0]!.p.id, fromName: surplus[0]!.p.name, freeHours: surplus[0]!.free,
          toProjectId: deficit[0]!.p.id, toName: deficit[0]!.p.name, overHours: deficit[0]!.over,
        }
      : null

  const effortItems = activeProjects.map((p) => ({ name: p.name, hours: p.totals.consumed }))

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

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Horas consumidas</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {totalHours.toFixed(0)}h
          </Text>
          {totalPlanned > 0 && <Text size="xs" c="dimmed" mt={2}>de {totalPlanned.toFixed(0)}h vendidas</Text>}
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Horas vendidas</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {totalPlanned.toFixed(0)}h
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Ingresos</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {formatEur(totalSold)}
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Margen ponderado</Text>
          <Text
            style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}
            {...(weightedMargin !== null ? { c: marginColor(weightedMargin) } : {})}
          >
            {weightedMargin !== null ? `${weightedMargin.toFixed(1)}%` : '—'}
          </Text>
        </Card>
      </SimpleGrid>

      {marcoClient && (
        <Card withBorder p="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Group gap="xs" align="center">
              <IconShieldCheck size={16} style={{ color: 'var(--mantine-color-blue-6)' }} />
              <Text size="sm" fw={600}>Acuerdo marco</Text>
              <Badge size="sm" variant="light" color="blue">{marcoClient.name}</Badge>
              {(marcoClient.start || marcoClient.end) && (
                <Text size="xs" c="dimmed">
                  Vigencia: {marcoClient.start ? formatDateEU(marcoClient.start) : '—'} – {marcoClient.end ? formatDateEU(marcoClient.end) : '—'}
                </Text>
              )}
            </Group>
            <AnchorLink href={`/clients/${marcoClient.id}`} size="xs">
              Ver tarifas / editar
            </AnchorLink>
          </Group>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: activeProjects.length >= 2 ? 2 : 1 }} spacing="sm">
        <MonthlyRevenueChart data={monthlyRevenue} />
        {activeProjects.length >= 2 && <EffortDistribution items={effortItems} />}
      </SimpleGrid>

      <WorkspaceTabs
        workspaceId={id}
        projects={projectData}
        transfers={transfers}
        transferSuggestion={transferSuggestion}
      />
    </Stack>
  )
}
