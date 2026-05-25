import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Stack, Title, Text, Card, Group, Badge } from '@mantine/core'
import { db } from '@/lib/db'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { projectAssignments, projects } from '@/db/schema'

const PROJECT_TYPE_LABELS: Record<string, string> = {
  fixed_bag: 'Bolsa fija',
  renewable_bag: 'Bolsa renovable',
  ongoing_capacity: 'Capacidad continua',
}

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

export default async function MyProjectsPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      allowedAreas: projectAssignments.allowedAreas,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(
      and(
        eq(projectAssignments.personId, person.id),
        eq(projectAssignments.isActive, true),
      ),
    )

  const active = rows.filter((r) => r.status === 'active')
  const other = rows.filter((r) => r.status !== 'active')

  return (
    <Stack p="md" gap="md">
      <Title order={3}>Mis proyectos</Title>

      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No tienes proyectos asignados.
        </Text>
      )}

      {active.length > 0 && (
        <Stack gap="xs">
          {active.map((project) => (
            <Card key={project.id} withBorder p="sm" radius="sm">
              <Group justify="space-between" align="flex-start" mb={4}>
                <Text fw={500}>{project.name}</Text>
                <Badge size="sm" color="gray" variant="light">
                  {PROJECT_TYPE_LABELS[project.type] ?? project.type}
                </Badge>
              </Group>
              <Group gap={4} mt={4}>
                {(project.allowedAreas as string[]).map((area) => (
                  <Badge key={area} size="xs" variant="outline" color="gray">
                    {AREA_LABELS[area] ?? area}
                  </Badge>
                ))}
              </Group>
              {(project.startDate ?? project.endDate) && (
                <Text size="xs" c="dimmed" mt={6}>
                  {project.startDate ?? ''}
                  {project.startDate && project.endDate ? ' → ' : ''}
                  {project.endDate ?? ''}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      )}

      {other.length > 0 && (
        <>
          <Text size="sm" c="dimmed" fw={500}>
            Cerrados / pausados
          </Text>
          <Stack gap="xs">
            {other.map((project) => (
              <Card key={project.id} withBorder p="sm" radius="sm" opacity={0.6}>
                <Group justify="space-between">
                  <Text fw={500} size="sm">
                    {project.name}
                  </Text>
                  <Badge size="sm" color="gray" variant="outline">
                    {project.status}
                  </Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  )
}
