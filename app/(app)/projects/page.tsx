import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Stack, Title, Group, Badge, Card, Text, Anchor, SimpleGrid } from '@mantine/core'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-helpers'
import { projects, workspaces } from '@/db/schema'

const TYPE_LABELS: Record<string, string> = {
  fixed_bag: 'Bolsa fija',
  renewable_bag: 'Bolsa renovable',
  ongoing_capacity: 'Capacidad continua',
}

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

export default async function ProjectsPage() {
  let person: Awaited<ReturnType<typeof requireRole>>
  try {
    person = await requireRole('manager')
  } catch {
    redirect('/today')
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      workspaceId: projects.workspaceId,
      workspaceName: workspaces.name,
    })
    .from(projects)
    .leftJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .orderBy(projects.status, projects.name)

  const active = rows.filter((r) => r.status === 'active')
  const rest = rows.filter((r) => r.status !== 'active')

  function ProjectCard({ project }: { project: (typeof rows)[number] }) {
    return (
      <Anchor href={`/projects/${project.id}`} underline="never">
        <Card withBorder p="md" radius="sm" style={{ cursor: 'pointer' }}>
          <Group justify="space-between" align="flex-start" mb={6}>
            <Text fw={600} size="sm">
              {project.name}
            </Text>
            <Badge size="sm" color={STATUS_COLOR[project.status] ?? 'gray'} variant="light">
              {STATUS_LABELS[project.status] ?? project.status}
            </Badge>
          </Group>
          {project.workspaceName && project.workspaceId && (
            <Anchor component={Link} href={`/workspaces/${project.workspaceId}`} size="xs" c="dimmed">
              {project.workspaceName}
            </Anchor>
          )}
          <Group gap="xs" mt={6}>
            <Badge size="xs" variant="outline" color="gray">
              {TYPE_LABELS[project.type] ?? project.type}
            </Badge>
            {project.endDate && (
              <Text size="xs" c="dimmed">
                hasta {project.endDate}
              </Text>
            )}
          </Group>
        </Card>
      </Anchor>
    )
  }

  return (
    <Stack p="md" gap="lg">
      <Title order={3}>Proyectos</Title>

      {rows.length === 0 && (
        <Text c="dimmed" size="sm">
          No hay proyectos todavía.
        </Text>
      )}

      {active.length > 0 && (
        <Stack gap="sm">
          <Text size="sm" fw={600} c="dimmed">
            Activos
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {rest.length > 0 && (
        <Stack gap="sm">
          <Text size="sm" fw={600} c="dimmed">
            Otros
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {rest.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </SimpleGrid>
        </Stack>
      )}
    </Stack>
  )
}
