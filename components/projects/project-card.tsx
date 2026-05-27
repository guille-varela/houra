'use client'

import { useRouter } from 'next/navigation'
import { Card, Stack, Group, Text, Badge } from '@mantine/core'
import { AnchorLink } from '@/components/ui/anchor-link'

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

type Props = {
  id: string
  name: string
  type: string
  status: string
  startDate: string | null
  endDate: string | null
  workspaceId: string | null
  workspaceName: string | null
}

const TYPE_LABELS: Record<string, string> = {
  fixed_bag: 'Bolsa fija',
  renewable_bag: 'Bolsa renovable',
  ongoing_capacity: 'Capacidad continua',
}

export function ProjectCard({ id, name, type, status, endDate, workspaceId, workspaceName }: Props) {
  const router = useRouter()

  return (
    <Card
      style={{ cursor: 'pointer', height: '100%' }}
      onClick={() => router.push(`/projects/${id}`)}
    >
      <Stack gap="xs" style={{ height: '100%' }}>
        <Group justify="space-between" align="flex-start">
          <Text fw={600} size="sm" style={{ flex: 1, lineHeight: 1.3 }}>
            {name}
          </Text>
          <Badge size="xs" color={STATUS_COLOR[status] ?? 'gray'} variant="light" radius="sm">
            {STATUS_LABELS[status] ?? status}
          </Badge>
        </Group>

        {workspaceName && workspaceId && (
          <AnchorLink
            href={`/workspaces/${workspaceId}`}
            size="xs"
            c="dimmed"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {workspaceName}
          </AnchorLink>
        )}

        <Group gap="xs" mt="auto">
          <Text size="xs" c="dimmed">
            {TYPE_LABELS[type] ?? type}
          </Text>
          {endDate && (
            <>
              <Text size="xs" c="dimmed">·</Text>
              <Text size="xs" c="dimmed">hasta {endDate}</Text>
            </>
          )}
        </Group>
      </Stack>
    </Card>
  )
}
