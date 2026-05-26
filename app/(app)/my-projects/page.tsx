import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Stack, Text, Card, Group, Badge } from '@mantine/core'
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
    <Stack p="md" gap="xl">
      <Text
        style={{
          fontSize: '1.0625rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        Mis proyectos
      </Text>

      {rows.length === 0 && (
        <Card>
          <Text c="dimmed" size="sm" ta="center" py="lg">
            No tienes proyectos asignados.
          </Text>
        </Card>
      )}

      {active.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Activos
          </Text>
          <Stack gap="xs">
            {active.map((project) => (
              <Card key={project.id} p="md">
                <Group justify="space-between" align="flex-start" mb={8}>
                  <Text fw={600} size="sm">{project.name}</Text>
                  <Badge size="xs" color="gray" variant="light" radius="sm">
                    {PROJECT_TYPE_LABELS[project.type] ?? project.type}
                  </Badge>
                </Group>
                <Group gap={6}>
                  {(project.allowedAreas as string[]).map((area) => (
                    <Badge key={area} size="xs" variant="light" color="gray" radius="sm">
                      {AREA_LABELS[area] ?? area}
                    </Badge>
                  ))}
                </Group>
                {(project.startDate ?? project.endDate) && (
                  <Text size="xs" c="dimmed" mt={8}>
                    {project.startDate ?? ''}
                    {project.startDate && project.endDate ? ' → ' : ''}
                    {project.endDate ?? ''}
                  </Text>
                )}
              </Card>
            ))}
          </Stack>
        </Stack>
      )}

      {other.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Cerrados / pausados
          </Text>
          <Stack gap="xs">
            {other.map((project) => (
              <Card key={project.id} p="md" style={{ opacity: 0.5 }}>
                <Group justify="space-between">
                  <Text fw={500} size="sm">{project.name}</Text>
                  <Badge size="xs" color="gray" variant="light" radius="sm">
                    {project.status}
                  </Badge>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}
