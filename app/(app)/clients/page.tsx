import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Group, Text, Badge, Stack, Title } from '@mantine/core'
import { IconBuilding, IconChevronRight, IconPlus } from '@tabler/icons-react'
import { requireRole } from '@/lib/auth-helpers'
import { getClients } from '@/actions/clients'
import NewClientButton from './new-client-button'

export default async function ClientsPage() {
  const person = await requireRole('manager').catch(() => null)
  if (!person) redirect('/today')

  const clientList = await getClients()

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <Group justify="space-between" align="center" mb="xl">
        <div>
          <Title order={2} style={{ color: 'var(--h-text)', letterSpacing: '-0.02em' }}>
            Clientes
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {clientList.length} {clientList.length === 1 ? 'cliente' : 'clientes'}
          </Text>
        </div>
        {person.appRole === 'admin' && <NewClientButton />}
      </Group>

      {clientList.length === 0 ? (
        <Stack align="center" gap="sm" py={60}>
          <IconBuilding size={36} strokeWidth={1} style={{ color: 'var(--h-text-disabled)' }} />
          <Text size="sm" c="dimmed">No hay clientes todavía</Text>
          {person.appRole === 'admin' && (
            <Text size="xs" c="dimmed">Usa el botón de arriba para añadir el primero</Text>
          )}
        </Stack>
      ) : (
        <Stack gap={4}>
          {clientList.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <Group
                justify="space-between"
                align="center"
                p="md"
                style={{
                  borderRadius: 10,
                  border: '1px solid var(--h-border)',
                  background: 'var(--h-surface-raised)',
                  transition: 'background 0.1s',
                  cursor: 'pointer',
                }}
              >
                <Group gap="sm">
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--h-surface-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <IconBuilding size={16} strokeWidth={1.5} style={{ color: 'var(--h-text-subtle)' }} />
                  </div>
                  <div>
                    <Text size="sm" fw={500} style={{ color: 'var(--h-text)' }}>{client.name}</Text>
                    {client.hasMarco && (
                      <Badge size="xs" variant="light" color="blue" mt={2}>Acuerdo Marco</Badge>
                    )}
                  </div>
                </Group>
                <IconChevronRight size={16} style={{ color: 'var(--h-text-disabled)' }} />
              </Group>
            </Link>
          ))}
        </Stack>
      )}
    </div>
  )
}
