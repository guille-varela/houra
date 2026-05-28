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
  Badge,
  Divider,
  Modal,
} from '@mantine/core'
import { IconArrowRight, IconCopy, IconRocket } from '@tabler/icons-react'
import {
  updateProposalStatus,
  duplicateProposal,
  convertProposalToProject,
  isValidProposalTransition,
} from '@/actions/proposals'
import type { ProposalStatus } from '@/actions/proposals'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  internal_review: 'Revisión interna',
  pending_approval: 'Pendiente aprobación',
  approved: 'Aprobada',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  internal_review: 'blue',
  pending_approval: 'orange',
  approved: 'green',
}

const ALL_STATUSES: ProposalStatus[] = ['draft', 'internal_review', 'pending_approval', 'approved']

type Props = {
  proposalId: string
  proposalName: string
  status: ProposalStatus
  convertedProjectId: string | null
  isAdmin: boolean
}

export default function ProposalSettingsTab({
  proposalId,
  proposalName,
  status,
  convertedProjectId,
  isAdmin,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusError, setStatusError] = useState<string | null>(null)
  const [dupError, setDupError] = useState<string | null>(null)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [dupModalOpen, setDupModalOpen] = useState(false)
  const [convertModalOpen, setConvertModalOpen] = useState(false)

  const validNextStatuses = ALL_STATUSES.filter((s) => isValidProposalTransition(status, s))

  function handleStatusChange() {
    if (!selectedStatus) return
    setStatusError(null)
    startTransition(async () => {
      const result = await updateProposalStatus(proposalId, selectedStatus as ProposalStatus)
      if (!result.ok) {
        setStatusError(result.error)
      } else {
        router.refresh()
        setSelectedStatus(null)
      }
    })
  }

  function handleDuplicate() {
    setDupError(null)
    startTransition(async () => {
      const result = await duplicateProposal(proposalId)
      if (!result.ok) {
        setDupError(result.error)
      } else {
        setDupModalOpen(false)
        router.push(`/proposals/${result.id}`)
      }
    })
  }

  function handleConvert() {
    setConvertError(null)
    startTransition(async () => {
      const result = await convertProposalToProject(proposalId)
      if (!result.ok) {
        setConvertError(result.error)
      } else {
        setConvertModalOpen(false)
        router.push(`/projects/${result.projectId}`)
      }
    })
  }

  return (
    <Stack gap="xl">
      {/* Estado */}
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Estado de la propuesta
        </Text>
        <Group gap="xs">
          <Text size="sm" c="dimmed">Estado actual:</Text>
          <Badge variant="light" color={STATUS_COLOR[status] ?? 'gray'}>
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
              placeholder="Nuevo estado…"
              data={validNextStatuses.map((s) => ({
                value: s,
                label: STATUS_LABELS[s] ?? s,
              }))}
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ flex: 1, maxWidth: 240 }}
              leftSection={<IconArrowRight size={14} />}
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
            Esta propuesta está aprobada. No hay más transiciones disponibles.
          </Text>
        )}
      </Stack>

      <Divider />

      {/* Duplicar */}
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Duplicar propuesta
        </Text>
        <Text size="xs" c="dimmed">
          Crea una copia con las mismas fases y líneas de equipo. Estado reiniciado a Borrador.
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
          leftSection={<IconCopy size={14} />}
          onClick={() => setDupModalOpen(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          Duplicar propuesta
        </Button>
      </Stack>

      {/* Convertir a proyecto — solo admin, solo approved, solo si no convertida */}
      {isAdmin && (
        <>
          <Divider />
          <Stack gap="sm">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
              Convertir a proyecto
            </Text>
            {convertedProjectId ? (
              <Group gap="sm">
                <Badge color="teal" variant="light">Ya convertida</Badge>
                <Button
                  size="sm"
                  variant="light"
                  color="teal"
                  component="a"
                  href={`/projects/${convertedProjectId}`}
                >
                  Ver proyecto
                </Button>
              </Group>
            ) : status !== 'approved' ? (
              <Text size="sm" c="dimmed">
                Solo se pueden convertir propuestas aprobadas. Cambia el estado a &quot;Aprobada&quot; primero.
              </Text>
            ) : (
              <>
                <Text size="xs" c="dimmed">
                  Se creará un proyecto en estado Borrador con las fases y asignaciones de esta propuesta.
                </Text>
                {convertError && (
                  <Alert color="red" variant="light" withCloseButton onClose={() => setConvertError(null)}>
                    {convertError}
                  </Alert>
                )}
                <Button
                  size="sm"
                  variant="light"
                  color="green"
                  leftSection={<IconRocket size={14} />}
                  onClick={() => setConvertModalOpen(true)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Convertir a proyecto
                </Button>
              </>
            )}
          </Stack>
        </>
      )}

      {/* Dup modal */}
      <Modal
        opened={dupModalOpen}
        onClose={() => setDupModalOpen(false)}
        title="Duplicar propuesta"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Se creará <strong>&quot;{proposalName} (copia)&quot;</strong> con las mismas fases y equipo estimado.
            El estado se reinicia a Borrador.
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

      {/* Convert modal */}
      <Modal
        opened={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        title="Convertir a proyecto"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Se creará el proyecto <strong>&quot;{proposalName}&quot;</strong> con las fases, áreas y personas
            definidas en esta propuesta. El proyecto empezará en estado Borrador.
          </Text>
          <Text size="xs" c="dimmed">
            Esta acción no se puede deshacer. La propuesta quedará marcada como convertida.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setConvertModalOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button color="green" loading={isPending} onClick={handleConvert}>
              Convertir a proyecto
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
