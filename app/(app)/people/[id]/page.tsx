import { notFound, redirect } from 'next/navigation'
import { eq, sql, desc } from 'drizzle-orm'
import { Stack, Text, Card, Group, Badge, SimpleGrid } from '@mantine/core'
import { db } from '@/lib/db'
import { persons, timeEntries, projectAssignments, projects } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import PersonActionsClient from './person-actions-client'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', contributor: 'Contributor',
}
const CATEGORY_LABELS: Record<string, string> = {
  trainee: 'Trainee', junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead', head: 'Head',
}
const AREA_LABELS: Record<string, string> = {
  research: 'Research', ux: 'UX', ui: 'UI',
}

type Props = { params: Promise<{ id: string }> }

export default async function PersonDetailPage({ params }: Props) {
  const { id } = await params

  let actor: Awaited<ReturnType<typeof requireRole>>
  try {
    actor = await requireRole('admin')
  } catch {
    redirect('/today')
  }

  const [person] = await db.select().from(persons).where(eq(persons.id, id)).limit(1)
  if (!person || person.organizationId !== actor.organizationId) notFound()

  const [stats] = await db
    .select({
      totalHours: sql<string>`COALESCE(SUM(${timeEntries.hours}::numeric), 0)`,
      entryCount: sql<string>`COUNT(${timeEntries.id})`,
      lastDate: sql<string | null>`MAX(${timeEntries.date})`,
    })
    .from(timeEntries)
    .where(eq(timeEntries.personId, id))

  const assignmentRows = await db
    .select({
      projectId: projectAssignments.projectId,
      projectName: projects.name,
      projectStatus: projects.status,
      isActive: projectAssignments.isActive,
      allowedAreas: projectAssignments.allowedAreas,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(eq(projectAssignments.personId, id))
    .orderBy(projectAssignments.isActive, projects.name)

  const isDeactivated = !!person.deactivatedAt
  const isAnonymized = !!person.anonymizedAt

  return (
    <Stack p="md" gap="xl">
      <Card p="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" mb={4}>
              <Text style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {person.name}
              </Text>
              {isAnonymized && <Badge size="sm" color="red" variant="light">Anonimizado</Badge>}
              {!isAnonymized && isDeactivated && <Badge size="sm" color="gray" variant="light">Desactivado</Badge>}
              {!isDeactivated && <Badge size="sm" color="green" variant="light">Activo</Badge>}
            </Group>
            {!isAnonymized && (
              <Text size="sm" c="dimmed">{person.email}</Text>
            )}
            <Group gap="xs" mt={6}>
              <Badge size="xs" variant="light" color="gray">{ROLE_LABELS[person.appRole] ?? person.appRole}</Badge>
              <Badge size="xs" variant="light" color="gray">{CATEGORY_LABELS[person.professionalCategory] ?? person.professionalCategory}</Badge>
              <Badge size="xs" variant="light" color="gray">{AREA_LABELS[person.primaryArea] ?? person.primaryArea}</Badge>
            </Group>
          </div>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Horas totales</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {parseFloat(stats?.totalHours ?? '0').toFixed(1)}h
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Entradas</Text>
          <Text style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {stats?.entryCount ?? '0'}
          </Text>
        </Card>
        <Card p="md">
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>Última entrada</Text>
          <Text style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {stats?.lastDate ?? '—'}
          </Text>
        </Card>
      </SimpleGrid>

      {assignmentRows.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Proyectos asignados
          </Text>
          {assignmentRows.map((a) => (
            <Card key={a.projectId} p="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{a.projectName}</Text>
                <Group gap="xs">
                  {(a.allowedAreas as string[]).map((area) => (
                    <Badge key={area} size="xs" variant="light" color="gray">
                      {AREA_LABELS[area] ?? area}
                    </Badge>
                  ))}
                  <Badge size="xs" variant="light" color={a.isActive ? 'green' : 'gray'}>
                    {a.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Acciones
        </Text>
        <Card p="md">
          <PersonActionsClient
            personId={id}
            isDeactivated={isDeactivated}
            isAnonymized={isAnonymized}
          />
        </Card>
      </Stack>
    </Stack>
  )
}
