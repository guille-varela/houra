'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Group,
  Text,
  NumberInput,
  Button,
  Alert,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  Select,
  TextInput,
} from '@mantine/core'
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react'
import { AREAS, ROLES, AREA_LABELS, ROLE_LABELS } from '@/lib/matrix'
import { upsertRate, deleteRate } from '@/actions/rates'

type Rate = {
  id: string
  area: string
  role: string
  costRateCents: number | null
  soldRateCents: number | null
  effectiveFrom: string
  effectiveTo: string | null
}

type Props = { rates: Rate[] }

function eurFromCents(cents: number | null): string {
  if (cents === null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function centsFromEur(eur: number | string): number | null {
  const n = typeof eur === 'string' ? parseFloat(eur) : eur
  if (isNaN(n)) return null
  return Math.round(n * 100)
}

export default function RatesClient({ rates: initialRates }: Props) {
  const [rates, setRates] = useState<Rate[]>(initialRates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCost, setEditCost] = useState<number | string>('')
  const [editSold, setEditSold] = useState<number | string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // New rate modal
  const [addOpen, setAddOpen] = useState(false)
  const [newArea, setNewArea] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<string | null>(null)
  const [newCost, setNewCost] = useState<number | string>('')
  const [newSold, setNewSold] = useState<number | string>('')
  const [newFrom, setNewFrom] = useState(new Date().toISOString().split('T')[0] as string)

  function startEdit(rate: Rate) {
    setEditingId(rate.id)
    setEditCost(rate.costRateCents !== null ? rate.costRateCents / 100 : '')
    setEditSold(rate.soldRateCents !== null ? rate.soldRateCents / 100 : '')
    setError(null)
  }

  function handleSaveEdit(rate: Rate) {
    setError(null)
    startTransition(async () => {
      const result = await upsertRate({
        id: rate.id,
        area: rate.area,
        role: rate.role,
        costRateCents: centsFromEur(editCost),
        soldRateCents: centsFromEur(editSold),
        effectiveFrom: rate.effectiveFrom,
        effectiveTo: rate.effectiveTo,
      })
      if (!result.ok) {
        setError(result.error)
      } else {
        setRates((prev) =>
          prev.map((r) =>
            r.id === rate.id
              ? { ...r, costRateCents: centsFromEur(editCost), soldRateCents: centsFromEur(editSold) }
              : r,
          ),
        )
        setEditingId(null)
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteRate({ id })
      if (!result.ok) {
        setError(result.error)
      } else {
        setRates((prev) => prev.filter((r) => r.id !== id))
      }
    })
  }

  function handleAddRate() {
    if (!newArea || !newRole) return
    setError(null)
    startTransition(async () => {
      const result = await upsertRate({
        area: newArea,
        role: newRole,
        costRateCents: centsFromEur(newCost),
        soldRateCents: centsFromEur(newSold),
        effectiveFrom: newFrom,
      })
      if (!result.ok) {
        setError(result.error)
      } else {
        setAddOpen(false)
        setNewArea(null)
        setNewRole(null)
        setNewCost('')
        setNewSold('')
      }
    })
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>
          Nueva tarifa
        </Button>
      </Group>

      <Table withTableBorder withColumnBorders fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Área</Table.Th>
            <Table.Th>Rol</Table.Th>
            <Table.Th ta="right">Coste/h</Table.Th>
            <Table.Th ta="right">Venta/h</Table.Th>
            <Table.Th>Desde</Table.Th>
            <Table.Th></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rates.map((rate) => (
            <Table.Tr key={rate.id}>
              <Table.Td>
                <Badge size="xs" variant="light" color="gray">
                  {AREA_LABELS[rate.area as keyof typeof AREA_LABELS] ?? rate.area}
                </Badge>
              </Table.Td>
              <Table.Td>{ROLE_LABELS[rate.role as keyof typeof ROLE_LABELS] ?? rate.role}</Table.Td>
              <Table.Td ta="right">
                {editingId === rate.id ? (
                  <NumberInput
                    value={editCost}
                    onChange={setEditCost}
                    min={0}
                    step={5}
                    size="xs"
                    prefix="€"
                    styles={{ input: { width: 90, textAlign: 'right' } }}
                  />
                ) : (
                  eurFromCents(rate.costRateCents)
                )}
              </Table.Td>
              <Table.Td ta="right">
                {editingId === rate.id ? (
                  <NumberInput
                    value={editSold}
                    onChange={setEditSold}
                    min={0}
                    step={5}
                    size="xs"
                    prefix="€"
                    styles={{ input: { width: 90, textAlign: 'right' } }}
                  />
                ) : (
                  eurFromCents(rate.soldRateCents)
                )}
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">{rate.effectiveFrom}</Text>
              </Table.Td>
              <Table.Td>
                <Group gap={4} justify="flex-end">
                  {editingId === rate.id ? (
                    <>
                      <Button size="xs" variant="light" loading={isPending} onClick={() => handleSaveEdit(rate)}>
                        Guardar
                      </Button>
                      <Button size="xs" variant="subtle" color="gray" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Tooltip label="Editar">
                        <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => startEdit(rate)} disabled={isPending}>
                          <IconEdit size={13} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(rate.id)} disabled={isPending}>
                          <IconTrash size={13} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Add rate modal */}
      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Nueva tarifa" size="sm">
        <Stack gap="sm">
          <Group grow>
            <Select
              label="Área"
              data={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))}
              value={newArea}
              onChange={setNewArea}
              required
            />
            <Select
              label="Rol"
              data={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              value={newRole}
              onChange={setNewRole}
              required
            />
          </Group>
          <Group grow>
            <NumberInput label="Coste/h (€)" value={newCost} onChange={setNewCost} min={0} step={5} prefix="€" />
            <NumberInput label="Venta/h (€)" value={newSold} onChange={setNewSold} min={0} step={5} prefix="€" />
          </Group>
          <TextInput label="Desde" type="date" value={newFrom} onChange={(e) => setNewFrom(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button loading={isPending} onClick={handleAddRate} disabled={!newArea || !newRole}>Guardar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
