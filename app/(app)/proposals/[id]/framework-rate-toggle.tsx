'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, Group, Stack, Text, Badge, Anchor, Modal, Button } from '@mantine/core'
import { IconShieldCheck, IconAlertTriangle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { updateProposalFrameworkRate } from '@/actions/proposals'

/** Propiedades del FrameworkRateToggle */
type Props = {
  proposalId: string
  /** El cliente tiene acuerdo marco activo */
  marcoAvailable: boolean
  /** Valor inicial de proposal.useFrameworkAgreementRate */
  initialUseFramework: boolean
  /** Nombre del cliente (para el copy del modal) */
  clientName: string | null
  /** ID del cliente (para enlazar a su configuración de acuerdo marco) */
  clientId: string | null
  /** % que suben los precios al pasar de marco → estándar (positivo) */
  priceIncreasePct: number | null
}

/**
 * F2.12 — Elección explícita de tarifa en Rentabilidad: acuerdo marco vs estándar.
 * Pasar a estándar (dirección "cara") pide confirmación; volver a marco no.
 */
export default function FrameworkRateToggle({
  proposalId,
  marcoAvailable,
  initialUseFramework,
  clientName,
  clientId,
  priceIncreasePct,
}: Props) {
  const [useFramework, setUseFramework] = useState(initialUseFramework)
  const [modalOpen, setModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function persist(next: boolean) {
    startTransition(async () => {
      const result = await updateProposalFrameworkRate(proposalId, next)
      if (result.ok) {
        setUseFramework(next)
        setModalOpen(false)
        notifications.show({
          color: 'green',
          message: next ? 'Aplicando acuerdo marco' : 'Aplicando tarifa estándar',
        })
      } else {
        notifications.show({ color: 'red', message: result.error })
      }
    })
  }

  if (!marcoAvailable) {
    return (
      <Card p="sm" withBorder>
        <Group gap="xs">
          <Text size="sm" c="dimmed">Tarifa aplicada:</Text>
          <Text size="sm" fw={500}>Tarifa estándar</Text>
          <Text size="xs" c="dimmed">· Este cliente no tiene acuerdo marco activo.</Text>
          {clientId && (
            <Anchor component={Link} href={`/clients/${clientId}`} size="xs">
              Configurar en Clientes
            </Anchor>
          )}
        </Group>
      </Card>
    )
  }

  return (
    <>
      <Card p="sm" withBorder>
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            <Text size="sm" c="dimmed">Tarifa aplicada:</Text>
            {useFramework ? (
              <>
                <Badge color="blue" variant="light" leftSection={<IconShieldCheck size={12} />}>
                  Acuerdo marco
                </Badge>
                {priceIncreasePct != null && priceIncreasePct > 0 && (
                  <Text size="xs" c="dimmed">−{priceIncreasePct.toFixed(0)}% vs tarifa estándar</Text>
                )}
              </>
            ) : (
              <Badge color="gray" variant="light">Tarifa estándar (no se aplica acuerdo marco)</Badge>
            )}
          </Group>
          {useFramework ? (
            <Anchor component="button" size="xs" c="dimmed" onClick={() => setModalOpen(true)} disabled={isPending}>
              Cambiar a tarifa estándar
            </Anchor>
          ) : (
            <Anchor component="button" size="xs" onClick={() => persist(true)} disabled={isPending}>
              Volver a acuerdo marco
            </Anchor>
          )}
        </Group>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Usar tarifa estándar" size="md" centered>
        <Stack gap="md">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <IconAlertTriangle size={20} style={{ color: 'var(--mantine-color-orange-6)', flexShrink: 0, marginTop: 2 }} />
            <Text size="sm">
              Vas a usar la tarifa estándar en lugar del acuerdo marco. Esto
              {priceIncreasePct != null && priceIncreasePct > 0 ? ` subirá los precios un ~${priceIncreasePct.toFixed(0)}%` : ' cambiará los precios'}
              {' '}respecto a la tarifa pactada{clientName ? ` con ${clientName}` : ''}. ¿Continuar?
            </Text>
          </Group>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button color="orange" loading={isPending} onClick={() => persist(false)}>
              Sí, usar tarifa estándar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
