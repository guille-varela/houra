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
  Chip,
} from '@mantine/core'
import { IconEdit, IconTrash, IconPlus, IconInfoCircle } from '@tabler/icons-react'
import { AREAS, ROLES, AREA_LABELS, ROLE_LABELS } from '@/lib/matrix'
import { notifications } from '@mantine/notifications'
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

function benefitCents(cost: number | null, sold: number | null): number | null {
  if (cost === null || sold === null) return null
  return sold - cost
}

function benefitPct(cost: number | null, sold: number | null): number | null {
  if (cost === null || sold === null || sold === 0) return null
  return ((sold - cost) / sold) * 100
}

export default function RatesClient({ rates: initialRates }: Props) {
  const [rates, setRates] = useState<Rate[]>(initialRates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCost, setEditCost] = useState<number | string>('')
  const [editSold, setEditSold] = useState<number | string>('')
  const [isPending, startTransition] = useTransition()

  // Filters
  const [filterArea, setFilterArea] = useState<string>('all')
  const [filterRole, setFilterRole] = useState<string>('all')

  // New rate modal
  const [addOpen, setAddOpen] = useState(false)
  const [newArea, setNewArea] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<string | null>(null)
  const [newCost, setNewCost] = useState<number | string>('')
  const [newSold, setNewSold] = useState<number | string>('')
  const [newFrom, setNewFrom] = useState(new Date().toISOString().split('T')[0] as string)

  const visibleRates = rates.filter((r) => {
    if (filterArea !== 'all' && r.area !== filterArea) return false
    if (filterRole !== 'all' && r.role !== filterRole) return false
    return true
  })

  function startEdit(rate: Rate) {
    setEditingId(rate.id)
    setEditCost(rate.costRateCents !== null ? rate.costRateCents / 100 : '')
    setEditSold(rate.soldRateCents !== null ? rate.soldRateCents / 100 : '')
  }

  function handleSaveEdit(rate: Rate) {
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
        notifications.show({ color: 'red', title: 'Error', message: result.error })
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
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        setRates((prev) => prev.filter((r) => r.id !== id))
      }
    })
  }

  function handleAddRate() {
    if (!newArea || !newRole) return
    startTransition(async () => {
      const result = await upsertRate({
        area: newArea,
        role: newRole,
        costRateCents: centsFromEur(newCost),
        soldRateCents: centsFromEur(newSold),
        effectiveFrom: newFrom,
      })
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
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
      <Group justify="space-between" align="flex-end">
        {/* Filters */}
        <Stack gap={6}>
          <Group gap={6}>
            <Text size="xs" c="dimmed" style={{ width: 30 }}>Área</Text>
            <Chip.Group value={filterArea} onChange={(v) => setFilterArea(v as string)}>
              <Group gap={4}>
                <Chip value="all" size="xs" variant="light">Todas</Chip>
                {AREAS.map((a) => (
                  <Chip key={a} value={a} size="xs" variant="light">
                    {AREA_LABELS[a as keyof typeof AREA_LABELS]}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </Group>
          <Group gap={6}>
            <Text size="xs" c="dimmed" style={{ width: 30 }}>Rol</Text>
            <Chip.Group value={filterRole} onChange={(v) => setFilterRole(v as string)}>
              <Group gap={4}>
                <Chip value="all" size="xs" variant="light">Todos</Chip>
                {ROLES.map((r) => (
                  <Chip key={r} value={r} size="xs" variant="light">
                    {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
          </Group>
        </Stack>

        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>
          Nueva tarifa
        </Button>
      </Group>

      {visibleRates.length === 0 && (
        <Text size="sm" c="dimmed">No hay tarifas que coincidan con el filtro.</Text>
      )}

      {visibleRates.length > 0 && (
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Área</Table.Th>
              <Table.Th>Rol</Table.Th>
              <Table.Th ta="right">Coste/h</Table.Th>
              <Table.Th ta="right">Venta/h</Table.Th>
              <Table.Th ta="right">
                <Group gap={4} justify="flex-end">
                  Beneficio/h
                  <Tooltip
                    label="Margen bruto por hora: Venta − Coste. El % muestra cuánto del precio de venta queda como beneficio."
                    multiline
                    w={260}
                    withArrow
                  >
                    <IconInfoCircle size={13} style={{ color: 'var(--h-text-disabled)', cursor: 'help' }} />
                  </Tooltip>
                </Group>
              </Table.Th>
              <Table.Th>
                <Group gap={4}>
                  Desde
                  <Tooltip
                    label="Fecha de vigencia. Permite llevar un historial cuando actualizas tarifas: las anteriores quedan registradas con su período."
                    multiline
                    w={260}
                    withArrow
                  >
                    <IconInfoCircle size={13} style={{ color: 'var(--h-text-disabled)', cursor: 'help' }} />
                  </Tooltip>
                </Group>
              </Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibleRates.map((rate) => {
              const benefit = benefitCents(rate.costRateCents, rate.soldRateCents)
              const pct = benefitPct(rate.costRateCents, rate.soldRateCents)

              return (
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
                  <Table.Td ta="right">
                    {editingId === rate.id ? (
                      <Text size="sm" c="dimmed">—</Text>
                    ) : benefit !== null ? (
                      <Group gap={6} justify="flex-end">
                        <Text size="sm" fw={500} c={benefit >= 0 ? 'teal' : 'red'}>
                          {eurFromCents(benefit)}
                        </Text>
                        {pct !== null && (
                          <Badge size="xs" variant="light" color={pct >= 20 ? 'green' : pct >= 5 ? 'yellow' : 'red'}>
                            {pct.toFixed(0)}%
                          </Badge>
                        )}
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">—</Text>
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
                            <ActionIcon size="md" variant="subtle" color="gray" onClick={() => startEdit(rate)} disabled={isPending}>
                              <IconEdit size={13} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Eliminar">
                            <ActionIcon size="md" variant="subtle" color="red" onClick={() => handleDelete(rate.id)} disabled={isPending}>
                              <IconTrash size={13} />
                            </ActionIcon>
                          </Tooltip>
                        </>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      )}

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
          <TextInput
            label="Desde"
            description="Fecha desde la que aplica esta tarifa"
            type="date"
            value={newFrom}
            onChange={(e) => setNewFrom(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button loading={isPending} onClick={handleAddRate} disabled={!newArea || !newRole}>Guardar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
