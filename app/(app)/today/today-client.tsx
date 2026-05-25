'use client'

import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { Stack, Group, Title, Text, Button, Badge, Card, ActionIcon, Alert } from '@mantine/core'
import { deleteTimeEntry } from '@/actions/time-entries'
import TimeEntryForm from '@/components/time-entries/time-entry-form'

type Entry = {
  id: string
  projectId: string
  date: string
  hours: string
  area: string
  description: string | null
}

type AssignedProject = {
  id: string
  name: string
  allowedAreas: string[]
}

type Props = {
  personName: string
  date: string
  dateLabel: string
  entries: Entry[]
  totalHours: number
  assignedProjects: AssignedProject[]
  projectNames: Record<string, string>
}

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

const SOFT_CAP = 14

export default function TodayClient({
  personName,
  date,
  dateLabel,
  entries,
  totalHours,
  assignedProjects,
  projectNames,
}: Props) {
  const [opened, { open, close }] = useDisclosure(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleteError(null)
    setDeletingId(id)
    const result = await deleteTimeEntry(id)
    setDeletingId(null)
    if (!result.ok) setDeleteError(result.error)
  }

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{personName}</Title>
          <Text c="dimmed" size="sm">
            {dateLabel}
          </Text>
        </div>
        <Badge size="lg" color={totalHours >= SOFT_CAP ? 'yellow' : 'gray'} variant="light">
          {totalHours.toFixed(1)}h
        </Badge>
      </Group>

      {totalHours >= SOFT_CAP && (
        <Alert color="yellow" variant="light">
          Has alcanzado el límite recomendado de {SOFT_CAP}h para hoy.
        </Alert>
      )}

      {deleteError && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      {entries.length === 0 ? (
        <Text c="dimmed" size="sm">
          No hay entradas registradas hoy.
        </Text>
      ) : (
        <Stack gap="xs">
          {entries.map((entry) => (
            <Card key={entry.id} withBorder p="sm" radius="sm">
              <Group justify="space-between" align="flex-start">
                <div style={{ flex: 1 }}>
                  <Text fw={500} size="sm">
                    {projectNames[entry.projectId] ?? '—'}
                  </Text>
                  <Group gap="xs" mt={2}>
                    <Text size="xs" c="dimmed">
                      {AREA_LABELS[entry.area] ?? entry.area}
                    </Text>
                    <Text size="xs" c="dimmed">·</Text>
                    <Text size="xs" c="dimmed">
                      {parseFloat(entry.hours).toFixed(1)}h
                    </Text>
                  </Group>
                  {entry.description && (
                    <Text size="xs" c="dimmed" mt={4} lineClamp={2}>
                      {entry.description}
                    </Text>
                  )}
                </div>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  loading={deletingId === entry.id}
                  onClick={() => handleDelete(entry.id)}
                  aria-label="Eliminar entrada"
                >
                  ×
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Button onClick={open} disabled={assignedProjects.length === 0}>
        + Añadir entrada
      </Button>

      {assignedProjects.length === 0 && (
        <Text size="xs" c="dimmed" ta="center">
          No tienes proyectos asignados. Pide a tu manager que te asigne uno.
        </Text>
      )}

      <TimeEntryForm
        opened={opened}
        onClose={close}
        assignedProjects={assignedProjects}
        defaultDate={date}
      />
    </Stack>
  )
}
