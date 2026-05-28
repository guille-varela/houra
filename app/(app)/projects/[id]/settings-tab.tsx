'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Stack,
  Group,
  Text,
  Button,
  Select,
  Alert,
  NumberInput,
  Table,
  Divider,
  Badge,
  Modal,
} from '@mantine/core'
import { updateProjectStatus, updateAllocation, duplicateProject, updateProjectMeta } from '@/actions/projects'
import { AREAS, ROLES, AREA_LABELS, ROLE_LABELS, type Allocation } from '@/lib/matrix'
import { isValidTransition, PROJECT_STATUSES } from '@/lib/schemas/project'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
}

const BILLING_MODEL_OPTIONS = [
  { value: 'hour_bag', label: 'Bolsa de horas' },
  { value: 'monthly_fee', label: 'Fee mensual' },
  { value: 'by_phase', label: 'Por entregable' },
]

type Props = {
  projectId: string
  projectName: string
  status: string
  allocation: Allocation
  billingModel: string
  clientId: string | null
  clients: Array<{ id: string; name: string }>
}

export default function SettingsTab({ projectId, projectName, status, allocation, billingModel, clientId, clients }: Props) {
  const router = useRouter()
  const [statusError, setStatusError] = useState<string | null>(null)
  const [allocError, setAllocError] = useState<string | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [dupError, setDupError] = useState<string | null>(null)
  const [dupModalOpen, setDupModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<string | null>(clientId)
  const [selectedBilling, setSelectedBilling] = useState<string | null>(billingModel)

  const isDraft = status === 'draft'

  // Local editable allocation state
  const [editAlloc, setEditAlloc] = useState<Allocation>(() => {
    const copy: Allocation = {}
    for (const area of AREAS) {
      copy[area] = {}
      for (const role of ROLES) {
        copy[area]![role] = allocation[area]?.[role] ?? 0
      }
    }
    return copy
  })

  const validNextStatuses = PROJECT_STATUSES.filter((s) => isValidTransition(status, s))

  function handleStatusChange() {
    if (!selectedStatus) return
    setStatusError(null)
    startTransition(async () => {
      const result = await updateProjectStatus({ projectId, status: selectedStatus })
      if (!result.ok) setStatusError(result.error)
    })
  }

  function handleAllocChange(area: string, role: string, value: number | string) {
    const num = typeof value === 'string' ? parseFloat(value) || 0 : value
    setEditAlloc((prev) => ({
      ...prev,
      [area]: { ...prev[area], [role]: num },
    }))
  }

  function handleSaveAlloc() {
    setAllocError(null)
    startTransition(async () => {
      const result = await updateAllocation({ projectId, allocation: editAlloc })
      if (!result.ok) setAllocError(result.error)
    })
  }

  function handleSaveMeta() {
    setMetaError(null)
    startTransition(async () => {
      const result = await updateProjectMeta(projectId, {
        clientId: selectedClient,
        billingModel: (selectedBilling ?? 'hour_bag') as 'hour_bag' | 'monthly_fee' | 'by_phase',
      })
      if (!result.ok) setMetaError(result.error)
    })
  }

  function handleDuplicate() {
    setDupError(null)
    startTransition(async () => {
      const result = await duplicateProject(projectId)
      if (!result.ok) {
        setDupError(result.error)
      } else {
        setDupModalOpen(false)
        router.push(`/projects/${result.newProjectId}`)
      }
    })
  }

  return (
    <Stack gap="xl">
      {/* Cliente + modelo de facturación */}
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Facturación
        </Text>
        <Group grow align="flex-start">
          <Select
            label="Cliente"
            placeholder="Proyecto interno (sin cliente)"
            data={clients.map((c) => ({ value: c.id, label: c.name }))}
            value={selectedClient}
            onChange={setSelectedClient}
            clearable
          />
          <Select
            label="Modelo de facturación"
            data={BILLING_MODEL_OPTIONS}
            value={selectedBilling}
            onChange={setSelectedBilling}
          />
        </Group>
        {metaError && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setMetaError(null)}>
            {metaError}
          </Alert>
        )}
        <Button size="sm" variant="light" loading={isPending} onClick={handleSaveMeta} style={{ alignSelf: 'flex-start' }}>
          Guardar
        </Button>
      </Stack>

      <Divider />

      {/* Status transition */}
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Estado del proyecto
        </Text>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Estado actual:
          </Text>
          <Badge variant="light" color="gray">
            {STATUS_LABELS[status] ?? status}
          </Badge>
        </Group>

        {statusError && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setStatusError(null)}>
            {statusError}
          </Alert>
        )}

        {validNextStatuses.length > 0 ? (
          <Group gap="sm">
            <Select
              placeholder="Nuevo estado..."
              data={validNextStatuses.map((s) => ({
                value: s,
                label: STATUS_LABELS[s] ?? s,
              }))}
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ flex: 1, maxWidth: 220 }}
            />
            <Button
              size="sm"
              variant="light"
              loading={isPending}
              disabled={!selectedStatus}
              onClick={handleStatusChange}
            >
              Cambiar estado
            </Button>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            No hay transiciones disponibles desde este estado.
          </Text>
        )}
      </Stack>

      <Divider />

      {/* Allocation matrix edit */}
      <Stack gap="sm">
        <Group gap="xs" align="flex-start">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Asignación de horas
          </Text>
          {!isDraft && (
            <Badge size="sm" color="gray" variant="light">
              Bloqueado (proyecto {STATUS_LABELS[status]?.toLowerCase()})
            </Badge>
          )}
        </Group>
        {isDraft ? (
          <Text size="xs" c="dimmed">
            Edita las horas planificadas por celda (área × rol). 0 = celda inactiva.
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            La asignación es editable solo en estado Borrador. Para modificar un proyecto activo usa un Amendment (Phase 04).
          </Text>
        )}

        {allocError && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setAllocError(null)}>
            {allocError}
          </Alert>
        )}

        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th></Table.Th>
              {ROLES.map((role) => (
                <Table.Th key={role} ta="center" style={{ minWidth: 90 }}>
                  {ROLE_LABELS[role]}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {AREAS.map((area) => (
              <Table.Tr key={area}>
                <Table.Td fw={500}>{AREA_LABELS[area]}</Table.Td>
                {ROLES.map((role) => (
                  <Table.Td key={role} p={4}>
                    <NumberInput
                      value={editAlloc[area]?.[role] ?? 0}
                      onChange={(v) => handleAllocChange(area, role, v)}
                      min={0}
                      step={10}
                      disabled={!isDraft || isPending}
                      size="xs"
                      styles={{ input: { textAlign: 'center' } }}
                    />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {isDraft && (
          <Button size="sm" variant="light" loading={isPending} onClick={handleSaveAlloc} style={{ alignSelf: 'flex-start' }}>
            Guardar asignación
          </Button>
        )}
      </Stack>

      <Divider />

      {/* Duplicate */}
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Duplicar proyecto
        </Text>
        <Text size="xs" c="dimmed">
          Crea una copia con la misma configuración (tipo, áreas, asignación, tarifas). Estado reiniciado a Borrador, sin entradas ni equipo.
        </Text>
        {dupError && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setDupError(null)}>
            {dupError}
          </Alert>
        )}
        <Button
          size="sm"
          variant="light"
          color="gray"
          onClick={() => setDupModalOpen(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          Duplicar proyecto
        </Button>
      </Stack>

      <Modal
        opened={dupModalOpen}
        onClose={() => setDupModalOpen(false)}
        title="Duplicar proyecto"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Se creará <strong>&quot;{projectName} (copia)&quot;</strong> con la configuración actual.
            El nuevo proyecto empieza en estado Borrador sin entradas ni equipo asignado.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setDupModalOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button loading={isPending} onClick={handleDuplicate}>
              Duplicar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
