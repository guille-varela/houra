'use client'

import { useState, useTransition } from 'react'
import {
  Drawer,
  Stack,
  Title,
  Text,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Alert,
  Group,
  Box,
  Divider,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { AREAS, ROLES, AREA_LABELS, ROLE_LABELS, type Allocation } from '@/lib/matrix'
import { notifications } from '@mantine/notifications'
import { createAmendment } from '@/actions/amendments'

/** Propiedades del componente AmendmentForm */
type Props = {
  /** ID del proyecto al que se aplica el amendment */
  projectId: string
  /** Asignación vigente usada como referencia para mostrar los valores actuales */
  effectiveAllocation: Allocation
  /** Controla si el drawer está abierto */
  opened: boolean
  /** Callback invocado al cerrar o cancelar el formulario */
  onClose: () => void
}

type DeltaAllocation = Record<string, Record<string, number>>

/** Drawer con formulario para crear un amendment de asignación de horas en un proyecto */
export default function AmendmentForm({ projectId, effectiveAllocation, opened, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [delta, setDelta] = useState<DeltaAllocation>(() => {
    const d: DeltaAllocation = {}
    for (const area of AREAS) {
      d[area] = {}
      for (const role of ROLES) {
        d[area]![role] = 0
      }
    }
    return d
  })

  const [reason, setReason] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().split('T')[0] as string,
  )

  function handleDeltaChange(area: string, role: string, value: number | string) {
    const num = typeof value === 'string' ? parseFloat(value) || 0 : value
    setDelta((prev) => ({ ...prev, [area]: { ...prev[area], [role]: num } }))
  }

  function handleClose() {
    setError(null)
    onClose()
  }

  function handleSubmit() {
    // Filter out zero deltas for cleaner storage
    const filteredDelta: DeltaAllocation = {}
    for (const area of AREAS) {
      for (const role of ROLES) {
        const v = delta[area]?.[role] ?? 0
        if (v !== 0) {
          if (!filteredDelta[area]) filteredDelta[area] = {}
          filteredDelta[area]![role] = v
        }
      }
    }

    if (Object.keys(filteredDelta).length === 0) {
      setError('Introduce al menos un cambio en la matriz')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await createAmendment({
        projectId,
        deltaAllocation: filteredDelta,
        reason,
        clientReference: clientRef || undefined,
        effectiveDate,
      })
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        handleClose()
      }
    })
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={<Title order={4}>Nuevo amendment</Title>}
      position="right"
      size="lg"
      padding="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Introduce los cambios de horas por celda (positivo para añadir, negativo para reducir).
          Los valores actuales se muestran debajo de cada campo.
        </Text>

        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Delta matrix */}
        <Stack gap="xs">
          <Text size="sm" fw={600}>Cambios en horas</Text>
          <Box style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 12, color: 'var(--mantine-color-gray-6)' }}></th>
                  {ROLES.map((role) => (
                    <th key={role} style={{ textAlign: 'center', padding: '4px 6px', fontSize: 11, color: 'var(--mantine-color-gray-6)', minWidth: 72 }}>
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AREAS.map((area) => (
                  <tr key={area}>
                    <td style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {AREA_LABELS[area]}
                    </td>
                    {ROLES.map((role) => {
                      const current = effectiveAllocation[area]?.[role] ?? 0
                      return (
                        <td key={role} style={{ padding: '4px 6px' }}>
                          <NumberInput
                            value={delta[area]?.[role] ?? 0}
                            onChange={(v) => handleDeltaChange(area, role, v)}
                            step={1}
                            size="xs"
                            description={current > 0 ? `${current}h` : undefined}
                            styles={{
                              input: { textAlign: 'center' },
                              description: { textAlign: 'center', fontSize: 10 },
                            }}
                            disabled={isPending}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Stack>

        <Divider />

        <DateInput
          label="Fecha efectiva"
          placeholder="DD/MM/AAAA"
          valueFormat="DD/MM/YYYY"
          value={effectiveDate || null}
          onChange={(v) => setEffectiveDate(v ?? '')}
          required
          disabled={isPending}
        />

        <Textarea
          label="Motivo"
          placeholder="Describe el motivo del cambio de scope..."
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          required
          minRows={2}
          disabled={isPending}
        />

        <TextInput
          label="Referencia cliente"
          placeholder="Nº orden de compra, email de aprobación..."
          value={clientRef}
          onChange={(e) => setClientRef(e.currentTarget.value)}
          disabled={isPending}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button loading={isPending} onClick={handleSubmit} disabled={!reason}>
            Guardar amendment
          </Button>
        </Group>
      </Stack>
    </Drawer>
  )
}
