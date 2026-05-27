'use client'

import { useState, useTransition } from 'react'
import {
  Drawer,
  Stack,
  Select,
  NumberInput,
  Textarea,
  Button,
  Alert,
  Text,
  Group,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { createTimeEntry } from '@/actions/time-entries'
import { getLocalDateString } from '@/lib/dates'

type AssignedProject = {
  id: string
  name: string
  allowedAreas: string[]
}

type Props = {
  opened: boolean
  onClose: () => void
  assignedProjects: AssignedProject[]
  defaultDate: string
}

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

const SOFT_CAP_HOURS = 14

export default function TimeEntryForm({ opened, onClose, assignedProjects, defaultDate }: Props) {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [date, setDate] = useState(defaultDate)
  const [hours, setHours] = useState<number | string>(1)
  const [area, setArea] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedProject = assignedProjects.find((p) => p.id === projectId)
  const areaOptions = (selectedProject?.allowedAreas ?? []).map((a) => ({
    value: a,
    label: AREA_LABELS[a] ?? a,
  }))

  const hoursNum = typeof hours === 'number' ? hours : parseFloat(String(hours)) || 0
  const nearCap = hoursNum >= SOFT_CAP_HOURS

  function reset() {
    setProjectId(null)
    setDate(getLocalDateString())
    setHours(1)
    setArea(null)
    setDescription('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!projectId) { setError('Selecciona un proyecto.'); return }
    if (!area) { setError('Selecciona un área.'); return }

    startTransition(async () => {
      const result = await createTimeEntry({
        projectId,
        date,
        hours: hoursNum,
        area,
        description: description.trim() || undefined,
      })
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
        return
      }
      handleClose()
    })
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title="Nueva entrada"
      position="bottom"
      size="auto"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm" pb="xl">
          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          <Select
            label="Proyecto"
            placeholder="Selecciona un proyecto"
            data={assignedProjects.map((p) => ({ value: p.id, label: p.name }))}
            value={projectId}
            onChange={(val) => {
              setProjectId(val)
              setArea(null)
            }}
            required
          />

          <Group grow>
            <div>
              <Text size="sm" fw={500} mb={4}>
                Fecha
              </Text>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.currentTarget.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--mantine-color-gray-4)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  fontSize: 'var(--mantine-font-size-sm)',
                }}
              />
            </div>

            <NumberInput
              label="Horas"
              value={hours}
              onChange={setHours}
              min={0.5}
              max={24}
              step={0.5}
              decimalScale={1}
              required
            />
          </Group>

          {nearCap && (
            <Alert color="yellow" variant="light">
              {hoursNum}h supera el límite recomendado de {SOFT_CAP_HOURS}h/día.
            </Alert>
          )}

          <Select
            label="Área"
            placeholder="Selecciona un área"
            data={areaOptions}
            value={area}
            onChange={setArea}
            disabled={!projectId}
            required
          />

          <Textarea
            label="Descripción (opcional)"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            rows={2}
            autosize
            maxRows={4}
          />

          <Button type="submit" loading={isPending} fullWidth>
            Guardar entrada
          </Button>
        </Stack>
      </form>
    </Drawer>
  )
}
