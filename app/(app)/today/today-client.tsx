'use client'

import { useState } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { Stack, Group, Text, Button, Card, ActionIcon, Alert } from '@mantine/core'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
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
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteTimeEntry(id)
    setDeletingId(null)
    if (!result.ok) {
      notifications.show({ color: 'red', title: 'Error', message: result.error })
    } else {
      notifications.show({ color: 'green', message: 'Entrada eliminada' })
    }
  }

  const over = totalHours >= SOFT_CAP

  return (
    <Stack p="md" gap="md">
      {/* KPI header — estilo stat card */}
      <Card>
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.05em' }}>
              {dateLabel}
            </Text>
            <Text
              style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                color: over ? 'var(--mantine-color-orange-6)' : 'var(--mantine-color-dark-9)',
              }}
            >
              {totalHours.toFixed(1)}h
            </Text>
            <Text size="sm" c="dimmed" mt={2}>
              {personName}
            </Text>
          </div>
        </Group>
      </Card>

      {over && (
        <Alert color="orange" variant="light" radius="lg">
          {totalHours.toFixed(1)}h registradas — por encima del límite recomendado de {SOFT_CAP}h.
        </Alert>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <Card>
          <Text c="dimmed" size="sm" ta="center" py="lg">
            No hay entradas registradas hoy.
          </Text>
        </Card>
      ) : (
        <Stack gap="xs">
          {entries.map((entry) => (
            <Card key={entry.id} p="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={500} size="sm" truncate>
                    {projectNames[entry.projectId] ?? '—'}
                  </Text>
                  <Group gap={6} mt={4}>
                    <Text size="xs" c="dimmed">{AREA_LABELS[entry.area] ?? entry.area}</Text>
                    <Text size="xs" c="dimmed">·</Text>
                    <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {parseFloat(entry.hours).toFixed(1)}h
                    </Text>
                  </Group>
                  {entry.description && (
                    <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
                      {entry.description}
                    </Text>
                  )}
                </div>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  loading={deletingId === entry.id}
                  onClick={() => handleDelete(entry.id)}
                  aria-label="Eliminar entrada"
                >
                  <IconTrash size={15} />
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Button
        onClick={open}
        disabled={assignedProjects.length === 0}
        leftSection={<IconPlus size={15} />}
        fullWidth
        size="md"
      >
        Añadir entrada
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
