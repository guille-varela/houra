import { redirect } from 'next/navigation'
import { eq, sql } from 'drizzle-orm'
import { Stack, Text, Card, Group, Badge } from '@mantine/core'
import { AnchorLink } from '@/components/ui/anchor-link'
import { db } from '@/lib/db'
import { persons, projects, timeEntries, workspaces } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { formatEur } from '@/lib/margin'

export default async function WorkspacesPage() {
  let person: Awaited<ReturnType<typeof requireRole>>
  try {
    person = await requireRole('manager')
  } catch {
    redirect('/today')
  }

  const workspaceRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.organizationId, person.organizationId))
    .orderBy(workspaces.status, workspaces.name)

  const workspaceData = await Promise.all(
    workspaceRows.map(async (w) => {
      const [stats] = await db
        .select({
          projectCount: sql<string>`COUNT(DISTINCT ${projects.id})`,
          totalHours: sql<string>`COALESCE(SUM(${timeEntries.hours}::numeric), 0)`,
          totalSold: sql<string>`COALESCE(SUM(${timeEntries.hours}::numeric * ${timeEntries.soldRateAtEntryCents}), 0)`,
        })
        .from(projects)
        .leftJoin(timeEntries, eq(timeEntries.projectId, projects.id))
        .leftJoin(persons, eq(persons.id, timeEntries.personId))
        .where(eq(projects.workspaceId, w.id))

      return {
        ...w,
        projectCount: parseInt(stats?.projectCount ?? '0'),
        totalHours: parseFloat(stats?.totalHours ?? '0'),
        totalSold: parseFloat(stats?.totalSold ?? '0'),
      }
    }),
  )

  const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', active: 'Activo', archived: 'Archivado' }
  const STATUS_COLOR: Record<string, string> = { draft: 'gray', active: 'green', archived: 'gray' }

  return (
    <Stack p="md" gap="xl">
      <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
        Workspaces
      </Text>

      <Stack gap="sm">
        {workspaceData.length === 0 && (
          <Card>
            <Text size="sm" c="dimmed" ta="center" py="lg">Sin workspaces registrados.</Text>
          </Card>
        )}
        {workspaceData.map((w) => (
          <Card key={w.id} p="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="xs" mb={4}>
                  <AnchorLink href={`/workspaces/${w.id}`} fw={600} size="sm" c="dark">
                    {w.name}
                  </AnchorLink>
                  <Badge size="xs" color={STATUS_COLOR[w.status] ?? 'gray'} variant="light">
                    {STATUS_LABELS[w.status] ?? w.status}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {w.projectCount} proyecto{w.projectCount !== 1 ? 's' : ''}
                </Text>
              </div>
              <Group gap="xl">
                <div style={{ textAlign: 'right' }}>
                  <Text size="xs" c="dimmed">Horas</Text>
                  <Text size="sm" fw={600}>{w.totalHours.toFixed(1)}h</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text size="xs" c="dimmed">Ingresos</Text>
                  <Text size="sm" fw={600}>{formatEur(w.totalSold)}</Text>
                </div>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
