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
        <Card style={{ cursor: 'pointer', height: '100%' }}>
          <Stack gap="xs" style={{ height: '100%' }}>
            <Group justify="space-between" align="flex-start">
              <Text fw={600} size="sm" style={{ flex: 1, lineHeight: 1.3 }}>
                {project.name}
              </Text>
              <Badge
                size="xs"
                color={STATUS_COLOR[project.status] ?? 'gray'}
                variant="light"
                radius="sm"
              >
                {STATUS_LABELS[project.status] ?? project.status}
              </Badge>
            </Group>

            {project.workspaceName && project.workspaceId && (
              <Anchor
                component={Link}
                href={`/workspaces/${project.workspaceId}`}
                size="xs"
                c="dimmed"
                onClick={(e) => e.stopPropagation()}
              >
                {project.workspaceName}
              </Anchor>
            )}

            <Group gap="xs" mt="auto">
              <Text size="xs" c="dimmed">
                {TYPE_LABELS[project.type] ?? project.type}
              </Text>
              {project.endDate && (
                <>
                  <Text size="xs" c="dimmed">·</Text>
                  <Text size="xs" c="dimmed">hasta {project.endDate}</Text>
                </>
              )}
            </Group>
          </Stack>
        </Card>
      </Anchor>
    )
  }

  return (
    <Stack p="md" gap="xl">
      <Title order={3} style={{ letterSpacing: '-0.02em' }}>Proyectos</Title>

      {rows.length === 0 && (
        <Card>
          <Text c="dimmed" size="sm" ta="center" py="lg">
            No hay proyectos todavía.
          </Text>
        </Card>
      )}

      {active.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
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
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
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
