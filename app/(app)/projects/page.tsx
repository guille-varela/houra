import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Stack, Title, Card, Text, SimpleGrid } from '@mantine/core'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-helpers'
import { projects, workspaces } from '@/db/schema'
import { ProjectCard } from '@/components/projects/project-card'

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
              <ProjectCard key={p.id} {...p} />
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
              <ProjectCard key={p.id} {...p} />
            ))}
          </SimpleGrid>
        </Stack>
      )}
    </Stack>
  )
}
