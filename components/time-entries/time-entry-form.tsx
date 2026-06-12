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
  Group,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { createTimeEntry } from '@/actions/time-entries'
import { getLocalDateString } from '@/lib/dates'

/** Proyecto asignado al usuario que puede seleccionar para imputar horas */
type AssignedProject = {
  /** ID único del proyecto */
  id: string
  /** Nombre visible del proyecto */
  name: string
  /** Áreas habilitadas para el usuario en este proyecto */
  allowedAreas: string[]
}

/** Propiedades del componente TimeEntryForm */
type Props = {
  /** Controla si el drawer está abierto */
  opened: boolean
  /** Callback invocado al cerrar o cancelar el formulario */
  onClose: () => void
  /** Lista de proyectos asignados al usuario para seleccionar */
  assignedProjects: AssignedProject[]
  /** Fecha preseleccionada al abrir el formulario, en formato ISO (YYYY-MM-DD) */
  defaultDate: string
}

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

const SOFT_CAP_HOURS = 14

/** Drawer con formulario para registrar una nueva entrada de tiempo en un proyecto asignado */
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
            <DateInput
              label="Fecha"
              placeholder="DD/MM/AAAA"
              valueFormat="DD/MM/YYYY"
              value={date || null}
              onChange={(v) => setDate(v ?? '')}
              required
            />

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
