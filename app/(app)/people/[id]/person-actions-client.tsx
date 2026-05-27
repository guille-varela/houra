'use client'

import { useState, useTransition } from 'react'
import { Button, Group, Modal, Text, Alert, Stack } from '@mantine/core'
import { IconUserOff, IconShieldOff } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { deactivatePerson, anonymizePerson } from '@/actions/people'

type Props = {
  personId: string
  isDeactivated: boolean
  isAnonymized: boolean
}

export default function PersonActionsClient({ personId, isDeactivated, isAnonymized }: Props) {
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [anonymizeOpen, setAnonymizeOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivatePerson(personId)
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        setDeactivateOpen(false)
      }
    })
  }

  function handleAnonymize() {
    startTransition(async () => {
      const result = await anonymizePerson(personId)
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        setAnonymizeOpen(false)
      }
    })
  }

  if (isAnonymized) return null

  return (
    <>
      <Group gap="sm">
        {!isDeactivated && (
          <Button
            variant="light"
            color="orange"
            size="sm"
            leftSection={<IconUserOff size={14} />}
            onClick={() => setDeactivateOpen(true)}
          >
            Desactivar
          </Button>
        )}
        <Button
          variant="light"
          color="red"
          size="sm"
          leftSection={<IconShieldOff size={14} />}
          onClick={() => setAnonymizeOpen(true)}
        >
          Anonimizar (GDPR)
        </Button>
      </Group>

      <Modal
        opened={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        title="Desactivar persona"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Esta persona dejará de aparecer en los selectores y no podrá registrar más horas.
            Sus datos históricos se conservan con atribución.
          </Text>
          <Text size="sm" c="dimmed">
            Esta acción es reversible contactando con el administrador de la base de datos.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setDeactivateOpen(false)}>
              Cancelar
            </Button>
            <Button color="orange" loading={isPending} onClick={handleDeactivate}>
              Confirmar desactivación
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={anonymizeOpen}
        onClose={() => setAnonymizeOpen(false)}
        title="Anonimizar persona (GDPR)"
        size="sm"
      >
        <Stack gap="md">
          <Alert color="red" variant="light">
            Esta acción es permanente e irreversible.
          </Alert>
          <Text size="sm">
            El nombre y el email serán reemplazados por un identificador anónimo.
            Los datos de imputación se conservan para mantener la integridad de los informes.
          </Text>
          <Text size="sm" c="dimmed">
            Úsala solo para ejercer el derecho al olvido (GDPR Art. 17).
            Una vez ejecutada, no es posible recuperar los datos personales.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setAnonymizeOpen(false)}>
              Cancelar
            </Button>
            <Button color="red" loading={isPending} onClick={handleAnonymize}>
              Confirmar anonimización
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
