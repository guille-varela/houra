'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Text,
  Card,
  Group,
  Badge,
  Button,
  Select,
  Checkbox,
  Alert,
  Divider,
} from '@mantine/core'
import { IconPlus, IconUserMinus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { upsertAssignment, deactivateAssignment } from '@/actions/project-assignments'

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

type AssignedRow = {
  assignmentId: string
  personId: string
  personName: string
  personRole: string
  personArea: string
  allowedAreas: string[]
  isActive: boolean
}

type PersonOption = {
  id: string
  name: string
  primaryArea: string
}

type Props = {
  projectId: string
  assignedRows: AssignedRow[]
  allPersons: PersonOption[]
}

export default function TeamTabClient({ projectId, assignedRows, allPersons }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Add person form state
  const [addPersonId, setAddPersonId] = useState<string | null>(null)
  const [addAreas, setAddAreas] = useState<string[]>([])
  const [showAddForm, setShowAddForm] = useState(false)

  const active = assignedRows.filter((r) => r.isActive)
  const inactive = assignedRows.filter((r) => !r.isActive)

  const addablePersons = allPersons.filter(
    (p) => !active.find((a) => a.personId === p.id),
  )

  function handleAddPersonChange(id: string | null) {
    setAddPersonId(id)
    if (id) {
      const p = allPersons.find((x) => x.id === id)
      setAddAreas(p ? [p.primaryArea] : [])
    } else {
      setAddAreas([])
    }
  }

  function handleSubmitAdd() {
    if (!addPersonId || addAreas.length === 0) {
      setError('Selecciona persona y al menos un área.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await upsertAssignment({ projectId, personId: addPersonId, allowedAreas: addAreas })
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
        return
      }
      setShowAddForm(false)
      setAddPersonId(null)
      setAddAreas([])
    })
  }

  function handleDeactivate(assignmentId: string) {
    startTransition(async () => {
      const result = await deactivateAssignment({ assignmentId })
      if (!result.ok) notifications.show({ color: 'red', title: 'Error', message: result.error })
    })
  }

  function handleReactivate(personId: string) {
    const person = allPersons.find((p) => p.id === personId)
    startTransition(async () => {
      const result = await upsertAssignment({
        projectId,
        personId,
        allowedAreas: person ? [person.primaryArea] : ['ux'],
      })
      if (!result.ok) notifications.show({ color: 'red', title: 'Error', message: result.error })
    })
  }

  return (
    <Stack gap="xl">
      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Group justify="space-between" align="center">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Equipo asignado
        </Text>
        <Button
          size="xs"
          leftSection={showAddForm ? undefined : <IconPlus size={12} />}
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? 'Cancelar' : 'Añadir persona'}
        </Button>
      </Group>

      {showAddForm && (
        <Card p="md">
          <Stack gap="sm">
            <Select
              label="Persona"
              placeholder="Selecciona..."
              data={addablePersons.map((p) => ({ value: p.id, label: p.name }))}
              value={addPersonId}
              onChange={handleAddPersonChange}
            />
            <div>
              <Text size="sm" fw={500} mb={6}>
                Áreas permitidas
              </Text>
              <Group gap="sm">
                {(['ux', 'ui', 'research'] as const).map((area) => (
                  <Checkbox
                    key={area}
                    label={AREA_LABELS[area]}
                    checked={addAreas.includes(area)}
                    onChange={(e) =>
                      setAddAreas((prev) =>
                        e.currentTarget.checked ? [...prev, area] : prev.filter((a) => a !== area),
                      )
                    }
                  />
                ))}
              </Group>
            </div>
            <Button size="sm" loading={isPending} onClick={handleSubmitAdd}>
              Asignar
            </Button>
          </Stack>
        </Card>
      )}

      {active.length === 0 && !showAddForm && (
        <Card>
          <Text size="sm" c="dimmed" ta="center" py="md">
            Sin personas asignadas.
          </Text>
        </Card>
      )}

      {active.map((row) => (
        <Card key={row.assignmentId} p="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={500} size="sm">
                {row.personName}
              </Text>
              <Text size="xs" c="dimmed">
                {row.personRole}
              </Text>
              <Group gap={4} mt={4}>
                {row.allowedAreas.map((area) => (
                  <Badge key={area} size="xs" variant="light" color="gray">
                    {AREA_LABELS[area] ?? area}
                  </Badge>
                ))}
              </Group>
            </div>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconUserMinus size={12} />}
              loading={isPending}
              onClick={() => handleDeactivate(row.assignmentId)}
            >
              Quitar
            </Button>
          </Group>
        </Card>
      ))}

      {inactive.length > 0 && (
        <>
          <Divider label="Inactivos" labelPosition="left" />
          {inactive.map((row) => (
            <Card key={row.assignmentId} p="sm" opacity={0.5}>
              <Group justify="space-between">
                <div>
                  <Text size="sm">{row.personName}</Text>
                  <Text size="xs" c="dimmed">
                    {row.personRole}
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="subtle"
                  loading={isPending}
                  onClick={() => handleReactivate(row.personId)}
                >
                  Reactivar
                </Button>
              </Group>
            </Card>
          ))}
        </>
      )}
    </Stack>
  )
}
