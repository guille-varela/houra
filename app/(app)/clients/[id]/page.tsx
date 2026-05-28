import { notFound, redirect } from 'next/navigation'
import { Title, Text, Group, Tabs } from '@mantine/core'
import { IconBuilding } from '@tabler/icons-react'
import { requireRole } from '@/lib/auth-helpers'
import { getClient } from '@/actions/clients'
import { db } from '@/lib/db'
import { projects } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import ClientProjectsTab from './client-projects-tab'
import MarcoAgreementTab from './marco-agreement-tab'

type Props = { params: Promise<{ id: string }> }

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const person = await requireRole('manager').catch(() => null)
  if (!person) redirect('/today')

  const client = await getClient(id)
  if (!client) notFound()

  const clientProjects = await db
    .select({ id: projects.id, name: projects.name, status: projects.status, billingModel: projects.billingModel })
    .from(projects)
    .where(and(eq(projects.clientId, id), eq(projects.organizationId, person.organizationId)))

  const isAdmin = person.appRole === 'admin'

  return (
    <div style={{ padding: '32px 40px' }}>
      <Group gap="sm" mb="xl" align="center">
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: 'var(--h-surface-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconBuilding size={18} strokeWidth={1.5} style={{ color: 'var(--h-text-subtle)' }} />
        </div>
        <div>
          <Title order={2} style={{ color: 'var(--h-text)', letterSpacing: '-0.02em' }}>
            {client.name}
          </Title>
          <Text size="xs" c="dimmed">
            {clientProjects.length} {clientProjects.length === 1 ? 'proyecto' : 'proyectos'}
          </Text>
        </div>
      </Group>

      <Tabs defaultValue="projects">
        <Tabs.List mb="lg">
          <Tabs.Tab value="projects">Proyectos</Tabs.Tab>
          <Tabs.Tab value="marco">
            Acuerdo Marco
            {client.hasMarco && (
              <span style={{
                marginLeft: 6,
                fontSize: 10,
                background: 'var(--mantine-color-blue-1)',
                color: 'var(--mantine-color-blue-7)',
                borderRadius: 4,
                padding: '1px 6px',
                fontWeight: 600,
              }}>Activo</span>
            )}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="projects">
          <ClientProjectsTab projects={clientProjects} />
        </Tabs.Panel>

        <Tabs.Panel value="marco">
          <MarcoAgreementTab client={client} isAdmin={isAdmin} />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
