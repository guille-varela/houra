import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Stack, Group, Badge, Text, Card } from '@mantine/core'
import { db } from '@/lib/db'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { projects, workspaces, clients } from '@/db/schema'
import { getClients } from '@/actions/clients'
import OverviewTab from './overview-tab'
import TeamTab from './team-tab'
import TimeEntriesTab from './time-entries-tab'
import SettingsTab from './settings-tab'
import MarginTab from './margin-tab'
import AmendmentsTab from './amendments-tab'
import ShareTab from './share-tab'
import ProjectTabs from './project-tabs'

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

const TYPE_LABELS: Record<string, string> = {
  fixed_bag: 'Bolsa fija',
  renewable_bag: 'Bolsa renovable',
  ongoing_capacity: 'Capacidad continua',
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ProjectDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams

  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  const isAdmin = person.appRole === 'admin'
  const isManager = person.appRole === 'manager' || isAdmin

  if (!isManager) redirect('/today')

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      originalAllocation: projects.originalAllocation,
      areasEnabled: projects.areasEnabled,
      weeklyHours: projects.weeklyHours,
      billingModel: projects.billingModel,
      clientId: projects.clientId,
      workspaceName: workspaces.name,
    })
    .from(projects)
    .leftJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .where(eq(projects.id, id))
    .limit(1)

  if (!project) notFound()

  const allocation = project.originalAllocation as Record<string, Record<string, number>>
  const activeTab = tab ?? 'overview'
  const clientList = isAdmin ? await getClients() : []

  return (
    <Stack p="md" gap="md">
      <Card p="md">
        <Group justify="space-between" align="flex-start" mb={6}>
          <Text style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {project.name}
          </Text>
          <Badge color={STATUS_COLOR[project.status] ?? 'gray'} variant="light">
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
        </Group>
        <Group gap="xs">
          {project.workspaceName && (
            <Text size="xs" c="dimmed">
              {project.workspaceName}
            </Text>
          )}
          <Badge size="xs" variant="light" color="gray">
            {TYPE_LABELS[project.type] ?? project.type}
          </Badge>
          {project.startDate && (
            <Text size="xs" c="dimmed">
              {project.startDate}
              {project.endDate ? ` → ${project.endDate}` : ''}
            </Text>
          )}
        </Group>
      </Card>

      <ProjectTabs
        defaultTab={activeTab}
        isAdmin={isAdmin}
        isManager={isManager}
        overview={
          <OverviewTab
            projectId={id}
            allocation={allocation}
            projectType={project.type}
            startDate={project.startDate}
            endDate={project.endDate}
          />
        }
        entries={<TimeEntriesTab projectId={id} />}
        margin={<MarginTab projectId={id} originalAllocation={allocation} />}
        amendments={
          <AmendmentsTab
            projectId={id}
            originalAllocation={allocation}
            projectStatus={project.status}
          />
        }
        share={<ShareTab projectId={id} />}
        team={isAdmin ? <TeamTab projectId={id} organizationId={person.organizationId} /> : null}
        settings={
          isAdmin ? (
            <SettingsTab
              projectId={id}
              projectName={project.name}
              status={project.status}
              allocation={allocation}
              billingModel={project.billingModel}
              clientId={project.clientId ?? null}
              clients={clientList.map((c) => ({ id: c.id, name: c.name }))}
            />
          ) : null
        }
      />
    </Stack>
  )
}
