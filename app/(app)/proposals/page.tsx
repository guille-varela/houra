import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Group, Text, Badge, Stack, Title } from '@mantine/core'
import { IconFileText, IconChevronRight } from '@tabler/icons-react'
import { requireRole } from '@/lib/auth-helpers'
import { getProposals } from '@/actions/proposals'
import NewProposalButton from './new-proposal-button'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  internal_review: 'Revisión interna',
  pending_approval: 'Pendiente aprobación',
  approved: 'Aprobada',
  paused: 'Pausada',
  expired: 'Caducada',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  internal_review: 'blue',
  pending_approval: 'orange',
  approved: 'green',
  paused: 'dark',
  expired: 'red',
}

export default async function ProposalsPage() {
  const person = await requireRole('manager').catch(() => null)
  if (!person) redirect('/today')

  const proposalList = await getProposals()

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <Group justify="space-between" align="center" mb="xl">
        <div>
          <Title order={2} style={{ color: 'var(--h-text)', letterSpacing: '-0.02em' }}>
            Propuestas
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {proposalList.length} {proposalList.length === 1 ? 'propuesta' : 'propuestas'}
          </Text>
        </div>
        <NewProposalButton />
      </Group>

      {proposalList.length === 0 ? (
        <Stack align="center" gap="sm" py={60}>
          <IconFileText size={36} strokeWidth={1} style={{ color: 'var(--h-text-disabled)' }} />
          <Text size="sm" c="dimmed">No hay propuestas todavía</Text>
          <Text size="xs" c="dimmed">Crea la primera usando el botón de arriba</Text>
        </Stack>
      ) : (
        <Stack gap={4}>
          {proposalList.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.id}`}
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
                    <IconFileText size={16} strokeWidth={1.5} style={{ color: 'var(--h-text-subtle)' }} />
                  </div>
                  <div>
                    <Text size="sm" fw={500} style={{ color: 'var(--h-text)' }}>{proposal.name}</Text>
                    <Group gap={6} mt={2}>
                      <Badge
                        size="xs"
                        variant="light"
                        color={STATUS_COLOR[proposal.status] ?? 'gray'}
                      >
                        {STATUS_LABELS[proposal.status] ?? proposal.status}
                      </Badge>
                      {proposal.convertedProjectId && (
                        <Badge size="xs" variant="light" color="teal">Convertida</Badge>
                      )}
                    </Group>
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
