'use client'

import { useState, useTransition } from 'react'
import { useDisclosure } from '@mantine/hooks'
import {
  Stack,
  Group,
  Text,
  Button,
  Badge,
  Card,
  ActionIcon,
  Drawer,
  Select,
  NumberInput,
  Textarea,
  Alert,
} from '@mantine/core'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { createTimeOffEntry, deleteTimeOffEntry } from '@/actions/time-off'

type Entry = {
  id: string
  date: string
  type: string
  hours: string | null
  note: string | null
}

const TYPE_LABELS: Record<string, string> = {
  holiday: 'Festivo',
  vacation: 'Vacaciones',
  sick_leave: 'Baja',
}

const TYPE_COLOR: Record<string, string> = {
  holiday: 'blue',
  vacation: 'green',
  sick_leave: 'orange',
}

function formatDateEs(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function groupByMonth(entries: Entry[]): Array<{ label: string; entries: Entry[] }> {
  const map = new Map<string, Entry[]>()
  for (const e of entries) {
    const key = e.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const [y, m] = key.split('-').map(Number)
    const label = new Date(y!, m! - 1, 1).toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    })
    return { label: label.charAt(0).toUpperCase() + label.slice(1), entries: items }
  })
}

export default function TimeOffClient({ entries }: { entries: Entry[] }) {
  const [opened, { open, close }] = useDisclosure(false)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [type, setType] = useState<string>('vacation')
  const [hoursPerDay, setHoursPerDay] = useState<number | string>(8)
  const [note, setNote] = useState('')

  function resetForm() {
    setStartDate(null)
    setEndDate(null)
    setType('vacation')
    setHoursPerDay(8)
    setNote('')
    setError(null)
  }

  function handleSubmit() {
    if (!startDate) { setError('Selecciona una fecha de inicio'); return }
    setError(null)
    startTransition(async () => {
      const result = await createTimeOffEntry({
        startDate,
        endDate: endDate ?? startDate,
        type,
        hoursPerDay: typeof hoursPerDay === 'number' ? hoursPerDay : 8,
        note: note || undefined,
      })
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        notifications.show({
          color: 'green',
          message: `${result.created} ${result.created === 1 ? 'día añadido' : 'días añadidos'}`,
        })
        resetForm()
        close()
      }
    })
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const result = await deleteTimeOffEntry({ id })
    setDeletingId(null)
    if (!result.ok) notifications.show({ color: 'red', title: 'Error', message: result.error })
  }

  const groups = groupByMonth(entries)
  const totalDays = entries.length

  return (
    <Stack p="md" gap="xl">
      <Group justify="space-between" align="center">
        <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Tiempo libre
        </Text>
        <Badge size="lg" variant="light" color="gray">
          {totalDays} {totalDays === 1 ? 'día' : 'días'}
        </Badge>
      </Group>

      {entries.length === 0 ? (
        <Card>
          <Text c="dimmed" size="sm" ta="center" py="md">
            No hay ausencias registradas.
          </Text>
        </Card>
      ) : (
        <Stack gap="lg">
          {groups.map((g) => (
            <Stack key={g.label} gap="xs">
              <Text
                size="xs"
                fw={600}
                c="dimmed"
                tt="uppercase"
                style={{ letterSpacing: '0.05em' }}
              >
                {g.label}
              </Text>
              {g.entries.map((entry) => (
                <Card key={entry.id} p="sm">
                  <Group justify="space-between" align="center">
                    <div>
                      <Group gap="xs" align="center">
                        <Text fw={500} size="sm">
                          {formatDateEs(entry.date)}
                        </Text>
                        <Badge
                          size="xs"
                          variant="light"
                          color={TYPE_COLOR[entry.type] ?? 'gray'}
                        >
                          {TYPE_LABELS[entry.type] ?? entry.type}
                        </Badge>
                      </Group>
                      <Group gap="xs" mt={2}>
                        {entry.hours && (
                          <Text size="xs" c="dimmed">
                            {parseFloat(entry.hours).toFixed(1)}h
                          </Text>
                        )}
                        {entry.note && (
                          <Text size="xs" c="dimmed">
                            · {entry.note}
                          </Text>
                        )}
                      </Group>
                    </div>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      loading={deletingId === entry.id}
                      onClick={() => handleDelete(entry.id)}
                      aria-label="Eliminar"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Card>
              ))}
            </Stack>
          ))}
        </Stack>
      )}

      <Button leftSection={<IconPlus size={14} />} onClick={open}>
        Añadir ausencia
      </Button>

      <Drawer
        opened={opened}
        onClose={() => { close(); resetForm() }}
        title="Añadir ausencia"
        position="bottom"
        size="auto"
      >
        <Stack gap="sm" pb="md">
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          <Select
            label="Tipo"
            value={type}
            onChange={(v) => setType(v ?? 'vacation')}
            data={[
              { value: 'vacation', label: 'Vacaciones' },
              { value: 'holiday', label: 'Festivo' },
              { value: 'sick_leave', label: 'Baja' },
            ]}
            required
          />

          <DateInput
            label="Fecha inicio"
            value={startDate}
            onChange={setStartDate}
            valueFormat="YYYY-MM-DD"
            placeholder="AAAA-MM-DD"
            required
          />

          <DateInput
            label="Fecha fin (opcional)"
            value={endDate}
            onChange={setEndDate}
            valueFormat="YYYY-MM-DD"
            placeholder="AAAA-MM-DD"
            description="Deja vacío si es un solo día"
          />

          <NumberInput
            label="Horas por día"
            value={hoursPerDay}
            onChange={setHoursPerDay}
            min={0.5}
            max={24}
            step={0.5}
            decimalScale={1}
          />

          <Textarea
            label="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            maxLength={200}
            rows={2}
          />

          <Button onClick={handleSubmit} loading={isPending} mt="xs">
            Guardar
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  )
}
