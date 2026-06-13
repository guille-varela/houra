'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Select,
  NumberInput,
  Alert,
  Badge,
  ActionIcon,
  Divider,
  Modal,
  Progress,
  Card,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash, IconPencil, IconCalendar, IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import {
  addProposalPhase,
  deleteProposalPhase,
  updateProposalPhase,
  addStaffingLine,
  deleteStaffingLine,
} from '@/actions/proposals'
import { computeFeasibility } from '@/lib/feasibility'
import { formatDateEU } from '@/lib/dates'
import InfoTooltip from '@/components/ui/info-tooltip'

const STAFFING_TYPE_OPTIONS = [
  {
    value: 'role',
    label: 'Perfil',
    description: 'Reserva una categoría sin asignar a una persona concreta todavía',
  },
  {
    value: 'person',
    label: 'Persona',
    description: 'Asigna una persona específica del equipo',
  },
]

const AREA_OPTIONS = [
  { value: 'research', label: 'Research' },
  { value: 'ux', label: 'UX' },
  { value: 'ui', label: 'UI' },
]

const ROLE_OPTIONS = [
  { value: 'head', label: 'Head' },
  { value: 'lead', label: 'Lead' },
  { value: 'senior', label: 'Senior' },
  { value: 'mid', label: 'Mid' },
  { value: 'junior', label: 'Junior' },
  { value: 'trainee', label: 'Trainee' },
]

type Phase = {
  id: string
  name: string
  billingAmount: string | null
  deliveryDate: string | null
  sortOrder: string
}

type StaffingLine = {
  id: string
  phaseId: string | null
  staffingType: 'person' | 'role'
  personId: string | null
  roleCategory: string | null
  area: string
  estimatedHours: string
}

type Person = {
  id: string
  name: string
  professionalCategory: string
}

type Props = {
  proposalId: string
  phases: Phase[]
  staffing: StaffingLine[]
  people: Person[]
  billingModel: string
  hoursPerDay: number
  holidays: string[]
}

export default function StaffingTab({
  proposalId,
  phases: initialPhases,
  staffing: initialStaffing,
  people,
  billingModel,
  hoursPerDay,
  holidays,
}: Props) {
  const [phases, setPhases] = useState<Phase[]>(initialPhases)
  const [staffing, setStaffing] = useState<StaffingLine[]>(initialStaffing)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Phase form state (sirve para crear y editar)
  const [phaseModalOpen, setPhaseModalOpen] = useState(false)
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseDelivery, setNewPhaseDelivery] = useState('')
  const [newPhaseBilling, setNewPhaseBilling] = useState<number | ''>('')

  function openPhaseModal(phase?: Phase) {
    setError(null)
    if (phase) {
      setEditingPhaseId(phase.id)
      setNewPhaseName(phase.name)
      setNewPhaseDelivery(phase.deliveryDate ?? '')
      setNewPhaseBilling(phase.billingAmount ? Number(phase.billingAmount) : '')
    } else {
      setEditingPhaseId(null)
      setNewPhaseName('')
      setNewPhaseDelivery('')
      setNewPhaseBilling('')
    }
    setPhaseModalOpen(true)
  }

  // Add staffing line form state
  const [staffingModalOpen, setStaffingModalOpen] = useState(false)
  const [newLinePhase, setNewLinePhase] = useState<string | null>(null)
  const [newLineType, setNewLineType] = useState<string | null>('role')
  const [newLineArea, setNewLineArea] = useState<string | null>(null)
  const [newLineRole, setNewLineRole] = useState<string | null>(null)
  const [newLinePerson, setNewLinePerson] = useState<string | null>(null)
  const [newLineHours, setNewLineHours] = useState<number | ''>(40)

  function handleSavePhase() {
    if (!newPhaseName.trim()) return
    setError(null)
    const billing = typeof newPhaseBilling === 'number' ? newPhaseBilling : null
    const delivery = newPhaseDelivery || null
    startTransition(async () => {
      try {
        if (editingPhaseId) {
          const result = await updateProposalPhase(editingPhaseId, {
            name: newPhaseName.trim(),
            billingAmount: billing,
            deliveryDate: delivery,
          })
          if (!result.ok) {
            setError(result.error)
            return
          }
          setPhases((prev) =>
            prev.map((p) =>
              p.id === editingPhaseId
                ? { ...p, name: newPhaseName.trim(), billingAmount: billing?.toString() ?? null, deliveryDate: delivery }
                : p,
            ),
          )
          notifications.show({ color: 'green', message: 'Fase actualizada · ' + newPhaseName.trim() })
        } else {
          const result = await addProposalPhase(proposalId, {
            name: newPhaseName.trim(),
            billingAmount: billing,
            deliveryDate: delivery,
          })
          setPhases((prev) => [
            ...prev,
            {
              id: result.id,
              name: newPhaseName.trim(),
              billingAmount: billing?.toString() ?? null,
              deliveryDate: delivery,
              sortOrder: String(prev.length),
            },
          ])
          notifications.show({ color: 'green', message: 'Fase creada · ' + newPhaseName.trim() })
        }
        setPhaseModalOpen(false)
        setEditingPhaseId(null)
        setNewPhaseName('')
        setNewPhaseDelivery('')
        setNewPhaseBilling('')
      } catch {
        setError(editingPhaseId ? 'Error al guardar la fase.' : 'Error al añadir la fase.')
      }
    })
  }

  function handleDeletePhase(phaseId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteProposalPhase(phaseId)
      if (result.ok) {
        setPhases((prev) => prev.filter((p) => p.id !== phaseId))
        setStaffing((prev) => prev.filter((s) => s.phaseId !== phaseId))
        notifications.show({ color: 'green', message: 'Fase eliminada' })
      } else {
        setError(result.error)
      }
    })
  }

  function handleAddStaffing() {
    if (!newLineArea || !newLineHours) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await addStaffingLine(proposalId, {
          phaseId: newLinePhase,
          staffingType: newLineType === 'person' ? 'person' : 'role',
          personId: newLineType === 'person' ? newLinePerson : null,
          roleCategory: newLineType === 'role' ? newLineRole : null,
          area: newLineArea,
          estimatedHours: typeof newLineHours === 'number' ? newLineHours : 0,
        })
        setStaffing((prev) => [
          ...prev,
          {
            id: result.id,
            phaseId: newLinePhase,
            staffingType: newLineType === 'person' ? 'person' : 'role',
            personId: newLineType === 'person' ? newLinePerson : null,
            roleCategory: newLineType === 'role' ? newLineRole : null,
            area: newLineArea,
            estimatedHours: String(newLineHours),
          },
        ])
        notifications.show({ color: 'green', message: 'Línea de equipo añadida' })
        setStaffingModalOpen(false)
        setNewLinePhase(null)
        setNewLineArea(null)
        setNewLineRole(null)
        setNewLinePerson(null)
        setNewLineHours(40)
      } catch {
        setError('Error al añadir la línea.')
      }
    })
  }

  function handleDeleteStaffing(lineId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteStaffingLine(lineId)
      if (result.ok) {
        setStaffing((prev) => prev.filter((s) => s.id !== lineId))
        notifications.show({ color: 'green', message: 'Línea de equipo eliminada' })
      } else {
        setError(result.error)
      }
    })
  }

  function getPersonName(personId: string) {
    return people.find((p) => p.id === personId)?.name ?? '—'
  }

  const phaseOptions = [
    { value: '__none__', label: 'Sin fase' },
    ...phases.map((p) => ({ value: p.id, label: p.name })),
  ]

  const totalHours = staffing.reduce((acc, s) => acc + Number(s.estimatedHours), 0)

  return (
    <Stack gap="xl">
      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Phases section */}
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Fases {phases.length > 0 && `(${phases.length})`}
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={12} />}
            onClick={() => openPhaseModal()}
          >
            Añadir fase
          </Button>
        </Group>

        {phases.length === 0 ? (
          <Text size="sm" c="dimmed">Sin fases definidas. Las fases permiten organizar el trabajo en entregables.</Text>
        ) : (
          <Stack gap={4}>
            {phases.map((phase) => (
              <Group
                key={phase.id}
                justify="space-between"
                align="center"
                p="sm"
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--h-border)',
                  background: 'var(--h-surface-raised)',
                }}
              >
                <Group gap="sm">
                  <Text size="sm" fw={500} style={{ color: 'var(--h-text)' }}>{phase.name}</Text>
                  {phase.deliveryDate && (
                    <Badge size="xs" variant="light" color="gray" leftSection={<IconCalendar size={10} />}>
                      {formatDateEU(phase.deliveryDate)}
                    </Badge>
                  )}
                  {phase.billingAmount && billingModel === 'by_phase' && (
                    <Badge size="xs" variant="light" color="teal">
                      {Number(phase.billingAmount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </Badge>
                  )}
                </Group>
                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    disabled={isPending}
                    onClick={() => openPhaseModal(phase)}
                    aria-label="Editar fase"
                  >
                    <IconPencil size={14} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDeletePhase(phase.id)}
                    aria-label="Borrar fase"
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>

      <Divider />

      {/* Staffing section */}
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
              Equipo estimado
            </Text>
            {totalHours > 0 && (
              <Badge size="sm" variant="light" color="blue">{totalHours}h total</Badge>
            )}
          </Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={12} />}
            onClick={() => setStaffingModalOpen(true)}
          >
            Añadir línea
          </Button>
        </Group>

        {staffing.length === 0 ? (
          <Text size="sm" c="dimmed">Sin líneas de staffing. Añade perfiles o personas estimadas para el proyecto.</Text>
        ) : (
          <Stack gap={4}>
            {staffing.map((line) => {
              const phaseName = line.phaseId ? phases.find((p) => p.id === line.phaseId)?.name : null
              return (
                <Group
                  key={line.id}
                  justify="space-between"
                  align="center"
                  p="sm"
                  style={{
                    borderRadius: 8,
                    border: '1px solid var(--h-border)',
                    background: 'var(--h-surface-raised)',
                  }}
                >
                  <Group gap="xs" wrap="wrap">
                    <Badge size="sm" variant="light" color="gray">{line.area.toUpperCase()}</Badge>
                    <Text size="sm" style={{ color: 'var(--h-text)' }}>
                      {line.staffingType === 'person'
                        ? getPersonName(line.personId!)
                        : (line.roleCategory ?? 'Perfil sin categoría')}
                    </Text>
                    <Badge size="xs" variant="outline" color="blue">{line.estimatedHours}h</Badge>
                    {phaseName && (
                      <Badge size="xs" variant="light" color="gray">{phaseName}</Badge>
                    )}
                    {line.staffingType === 'role' && (
                      <Badge size="xs" variant="dot" color="gray">Perfil</Badge>
                    )}
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDeleteStaffing(line.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              )
            })}
          </Stack>
        )}
      </Stack>

      {/* Feasibility section */}
      <FeasibilityWidget
        phases={phases}
        staffing={staffing}
        hoursPerDay={hoursPerDay}
        holidays={holidays}
      />

      {/* Add phase modal */}
      <Modal
        opened={phaseModalOpen}
        onClose={() => { setPhaseModalOpen(false); setEditingPhaseId(null) }}
        title={editingPhaseId ? 'Editar fase' : 'Añadir fase'}
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Nombre"
            placeholder="Fase 1 — Discovery…"
            value={newPhaseName}
            onChange={(e) => setNewPhaseName(e.currentTarget.value)}
            autoFocus
          />
          <DateInput
            label="Fecha de entrega"
            placeholder="DD/MM/AAAA"
            valueFormat="DD/MM/YYYY"
            value={newPhaseDelivery || null}
            onChange={(v) => setNewPhaseDelivery(v ?? '')}
            leftSection={<IconCalendar size={14} />}
            clearable
          />
          {billingModel === 'by_phase' && (
            <NumberInput
              label="Importe de facturación (€)"
              placeholder="0"
              value={newPhaseBilling}
              onChange={(v) => setNewPhaseBilling(typeof v === 'number' ? v : '')}
              min={0}
              prefix="€"
            />
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setPhaseModalOpen(false)}>
              Cancelar
            </Button>
            <Button loading={isPending} disabled={!newPhaseName.trim()} onClick={handleSavePhase}>
              {editingPhaseId ? 'Guardar' : 'Añadir'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add staffing line modal */}
      <Modal
        opened={staffingModalOpen}
        onClose={() => setStaffingModalOpen(false)}
        title="Añadir línea de equipo"
        size="sm"
      >
        <Stack gap="md">
          {phases.length > 0 && (
            <Select
              label="Fase (opcional)"
              placeholder="Sin fase"
              data={phaseOptions}
              value={newLinePhase ?? '__none__'}
              onChange={(v) => setNewLinePhase(v === '__none__' ? null : v)}
              clearable
            />
          )}
          <Select
            label="Tipo de persona"
            placeholder="Selecciona…"
            data={STAFFING_TYPE_OPTIONS}
            value={newLineType}
            onChange={setNewLineType}
            renderOption={({ option }) => {
              const meta = STAFFING_TYPE_OPTIONS.find((o) => o.value === option.value)
              return (
                <Stack gap={0}>
                  <Text size="sm">{option.label}</Text>
                  {meta && <Text size="xs" c="dimmed">{meta.description}</Text>}
                </Stack>
              )
            }}
          />
          <Select
            label="Área"
            placeholder="Selecciona…"
            data={AREA_OPTIONS}
            value={newLineArea}
            onChange={setNewLineArea}
          />
          {newLineType === 'role' && (
            <Select
              label="Categoría"
              placeholder="Cualquier perfil"
              data={ROLE_OPTIONS}
              value={newLineRole}
              onChange={setNewLineRole}
              clearable
            />
          )}
          {newLineType === 'person' && (
            <Select
              label="Persona"
              placeholder="Selecciona…"
              data={people.map((p) => ({ value: p.id, label: `${p.name} (${p.professionalCategory})` }))}
              value={newLinePerson}
              onChange={setNewLinePerson}
              searchable
            />
          )}
          <NumberInput
            label="Horas estimadas"
            placeholder="Ej. 200"
            value={newLineHours}
            onChange={(v) => setNewLineHours(typeof v === 'number' ? v : '')}
            min={1}
            suffix="h"
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setStaffingModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={isPending}
              disabled={!newLineArea || !newLineHours}
              onClick={handleAddStaffing}
            >
              Añadir
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ─── Feasibility widget ───────────────────────────────────────────────────────

function FeasibilityWidget({
  phases,
  staffing,
  hoursPerDay,
  holidays,
}: {
  phases: Phase[]
  staffing: StaffingLine[]
  hoursPerDay: number
  holidays: string[]
}) {
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const holidaySet = useMemo(() => new Set(holidays), [holidays])

  const totalHours = staffing.reduce((acc, s) => acc + parseFloat(s.estimatedHours), 0)

  // Latest delivery date across all phases
  const latestDeadline = useMemo(() => {
    const dates = phases.map((p) => p.deliveryDate).filter(Boolean) as string[]
    if (dates.length === 0) return null
    return dates.sort().at(-1) ?? null
  }, [phases])

  const result = useMemo(() => {
    if (!latestDeadline || totalHours === 0) return null
    return computeFeasibility({
      deadline: latestDeadline,
      today: todayIso,
      totalEstimatedHours: totalHours,
      staffingLines: Math.max(staffing.length, 1),
      hoursPerDay,
      holidaySet,
    })
  }, [latestDeadline, totalHours, staffing.length, hoursPerDay, holidaySet, todayIso])

  if (staffing.length === 0 || totalHours === 0) return null

  const loadPct = result ? Math.min((result.fteNeeded / Math.max(result.staffingLines, 1)) * 100, 200) : 0
  const barColor = result?.ok ? 'green' : 'red'

  return (
    <>
      <Divider />
      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Viabilidad del plazo
        </Text>
        <Text size="xs" c="dimmed">
          Basado en {hoursPerDay}h/día útil · festivos Madrid (ES-MD)
        </Text>

        {!latestDeadline ? (
          <Text size="sm" c="dimmed">
            Añade una fecha de entrega a alguna fase para ver si el plazo es viable.
          </Text>
        ) : result ? (
          <Card
            p="md"
            style={{
              border: `1px solid ${result.ok ? 'var(--mantine-color-green-3)' : 'var(--mantine-color-red-3)'}`,
              background: result.ok ? 'var(--mantine-color-green-0)' : 'var(--mantine-color-red-0)',
            }}
          >
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Group gap="xs">
                  {result.ok
                    ? <IconCircleCheck size={16} style={{ color: 'var(--mantine-color-green-6)', flexShrink: 0 }} />
                    : <IconAlertTriangle size={16} style={{ color: 'var(--mantine-color-red-6)', flexShrink: 0 }} />
                  }
                  <Text size="sm" fw={600} c={result.ok ? 'green' : 'red'}>
                    {result.ok ? 'Plazo viable' : 'Plazo ajustado'}
                  </Text>
                </Group>
                <Badge size="sm" variant="light" color="gray">
                  Entrega: {formatDateEU(latestDeadline)}
                </Badge>
              </Group>

              <Group gap="xl">
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Días hábiles</Text>
                  <Text size="sm" fw={600}>{result.workingDays} días</Text>
                </Stack>
                <Stack gap={2}>
                  <Group gap={2} align="center">
                    <Text size="xs" c="dimmed">Capacidad (1 perfil)</Text>
                    <InfoTooltip
                      label="Capacidad disponible de un perfil en horas. Calculado como: días laborables del plazo × horas/día útil − festivos. No incluye vacaciones planificadas ni la carga de otros proyectos en paralelo."
                    />
                  </Group>
                  <Text size="sm" fw={600}>{result.availableHours.toFixed(0)}h</Text>
                </Stack>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Horas estimadas</Text>
                  <Text size="sm" fw={600}>{totalHours.toFixed(0)}h</Text>
                </Stack>
                <Stack gap={2}>
                  <Text size="xs" c="dimmed">Perfiles en paralelo</Text>
                  <Text size="sm" fw={600}>{result.staffingLines} definidos</Text>
                </Stack>
              </Group>

              <Stack gap={4}>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Carga del equipo: {(result.fteNeeded * 100).toFixed(0)}%
                    {result.fteNeeded > 1 && ` · necesita ${Math.ceil(result.fteNeeded)} FTE`}
                  </Text>
                  {result.surplus >= 0 ? (
                    <Text size="xs" c="green">{result.surplus.toFixed(0)}h de margen</Text>
                  ) : (
                    <Text size="xs" c="red">
                      Faltan {Math.abs(result.surplus).toFixed(0)}h · {result.daysShort} días extra (1 perfil)
                    </Text>
                  )}
                </Group>
                <Progress
                  value={Math.min((result.fteNeeded / Math.max(result.staffingLines, 1)) * 100, 100)}
                  color={barColor}
                  size="sm"
                />
              </Stack>

              {!result.ok && (
                <Text size="xs" c="red">
                  Con {result.staffingLines} {result.staffingLines === 1 ? 'perfil' : 'perfiles'} en paralelo,
                  el proyecto necesita {Math.ceil(result.fteNeeded * result.availableHours / result.staffingLines)}h
                  por perfil. Considera ampliar el plazo o añadir más perfiles al equipo.
                </Text>
              )}
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </>
  )
}
