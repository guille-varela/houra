'use client'

import { useState, useTransition } from 'react'
import { Stack, NumberInput, Button, Alert } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { updateOrganizationSettings } from '@/actions/organizations'

type Props = {
  defaultTargetMarginPct: number
  proposalExpiryDays: number
}

export default function OrganizationClient({ defaultTargetMarginPct, proposalExpiryDays }: Props) {
  const [margin, setMargin] = useState<number | ''>(defaultTargetMarginPct)
  const [expiryDays, setExpiryDays] = useState<number | ''>(proposalExpiryDays)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateOrganizationSettings({
        ...(typeof margin === 'number' ? { defaultTargetMarginPct: margin } : {}),
        ...(typeof expiryDays === 'number' ? { proposalExpiryDays: expiryDays } : {}),
      })
      if (result.ok) {
        notifications.show({ color: 'green', message: 'Ajustes de organización guardados' })
      } else {
        setError('No se pudieron guardar los ajustes.')
      }
    })
  }

  return (
    <Stack gap="lg" style={{ maxWidth: 360 }}>
      <NumberInput
        label="Margen objetivo por defecto (%)"
        description="Se aplica a las propuestas con 'Usar margen estándar de empresa' activado"
        value={margin}
        onChange={(v) => setMargin(typeof v === 'number' ? v : '')}
        min={0}
        max={100}
        suffix="%"
      />
      <NumberInput
        label="Caducidad de propuestas (días)"
        description="Una propuesta pendiente de aprobación caduca si no se actualiza en este plazo"
        value={expiryDays}
        onChange={(v) => setExpiryDays(typeof v === 'number' ? v : '')}
        min={1}
        suffix=" días"
      />
      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Button size="sm" variant="light" loading={isPending} onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
        Guardar cambios
      </Button>
    </Stack>
  )
}
