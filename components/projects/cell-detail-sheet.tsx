'use client'

import { useEffect, useState } from 'react'
import { Drawer, Stack, Text, Group, Badge, Loader, Card, Title } from '@mantine/core'
import { AREA_LABELS, ROLE_LABELS, type MatrixCell } from '@/lib/matrix'
import { getCellEntries } from '@/actions/projects-query'

type EntryRow = {
  personName: string
  date: string
  hours: number
  description: string | null
}

type Props = {
  cell: MatrixCell
  projectId: string
  onClose: () => void
}

export default function CellDetailSheet({ cell, projectId, onClose }: Props) {
  const [entries, setEntries] = useState<EntryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEntries(null)
    setError(null)
    getCellEntries({ projectId, area: cell.area, role: cell.role }).then((result) => {
      if (result.ok) {
        setEntries(result.entries)
      } else {
        setError(result.error)
      }
    })
  }, [projectId, cell.area, cell.role])

  const totalHours = entries?.reduce((s, e) => s + e.hours, 0) ?? 0

  return (
    <Drawer
      opened
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600}>{AREA_LABELS[cell.area]}</Text>
          <Text c="dimmed">·</Text>
          <Text fw={600}>{ROLE_LABELS[cell.role]}</Text>
        </Group>
      }
      position="right"
      size="md"
    >
      <Stack gap="sm">
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Planificado:
          </Text>
          <Text size="sm" fw={500}>
            {cell.planned}h
          </Text>
          <Text size="sm" c="dimmed" ml="xs">
            Consumido:
          </Text>
          <Text size="sm" fw={500}>
            {cell.consumed.toFixed(1)}h
          </Text>
        </Group>

        <Title order={6} mt="xs">
          Entradas
        </Title>

        {!entries && !error && <Loader size="sm" />}
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        {entries && entries.length === 0 && (
          <Text size="sm" c="dimmed">
            Sin entradas registradas.
          </Text>
        )}
        {entries && entries.length > 0 && (
          <>
            {entries.map((e, i) => (
              <Card key={i} withBorder p="xs" radius="sm">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="sm" fw={500}>
                      {e.personName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {e.date}
                    </Text>
                    {e.description && (
                      <Text size="xs" c="dimmed" mt={2} lineClamp={2}>
                        {e.description}
                      </Text>
                    )}
                  </div>
                  <Badge size="sm" variant="light" color="gray">
                    {e.hours.toFixed(1)}h
                  </Badge>
                </Group>
              </Card>
            ))}
            <Text size="xs" c="dimmed" ta="right">
              Total: {totalHours.toFixed(1)}h
            </Text>
          </>
        )}
      </Stack>
    </Drawer>
  )
}
