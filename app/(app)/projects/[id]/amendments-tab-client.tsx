'use client'

import { useState } from 'react'
import { Stack, Group, Text, Button, Badge, Paper, Divider } from '@mantine/core'
import AmendmentForm from '@/components/projects/amendment-form'
import { type Allocation } from '@/lib/matrix'

type Amendment = {
  id: string
  effectiveDate: string
  reason: string
  clientReference: string | null
  createdByName: string
  createdAt: string
  deltaAllocation: Record<string, Record<string, number>>
}

type Props = {
  projectId: string
  amendments: Amendment[]
  effectiveAllocation: Allocation
  canCreate: boolean  // true when project is active or paused
}

function formatDeltaSummary(delta: Record<string, Record<string, number>>): string {
  const parts: string[] = []
  for (const [area, roles] of Object.entries(delta)) {
    for (const [role, hours] of Object.entries(roles)) {
      if (hours !== 0) {
        const sign = hours > 0 ? '+' : ''
        parts.push(`${sign}${hours}h ${area.toUpperCase()}/${role}`)
      }
    }
  }
  return parts.join(', ') || 'Sin cambios'
}

export default function AmendmentsTabClient({
  projectId,
  amendments,
  effectiveAllocation,
  canCreate,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <Stack gap="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            Nuevo amendment
          </Button>
        </Group>
      )}

      {amendments.length === 0 ? (
        <Text size="sm" c="dimmed">
          Sin amendments registrados.{' '}
          {canCreate
            ? 'Crea uno para modificar el scope sin alterar la asignación original.'
            : 'Los amendments solo se pueden crear cuando el proyecto está activo o pausado.'}
        </Text>
      ) : (
        <Stack gap="sm">
          {amendments.map((a) => (
            <Paper key={a.id} withBorder p="md" radius="sm">
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={600}>{a.reason}</Text>
                <Badge size="xs" variant="outline" color="gray">{a.effectiveDate}</Badge>
              </Group>
              <Text size="xs" c="dimmed" mb={6}>{formatDeltaSummary(a.deltaAllocation)}</Text>
              <Divider my={6} />
              <Group gap="xs">
                <Text size="xs" c="dimmed">Por {a.createdByName}</Text>
                {a.clientReference && (
                  <>
                    <Text size="xs" c="dimmed">·</Text>
                    <Text size="xs" c="dimmed">Ref: {a.clientReference}</Text>
                  </>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <AmendmentForm
        projectId={projectId}
        effectiveAllocation={effectiveAllocation}
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Stack>
  )
}
