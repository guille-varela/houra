'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Group,
  Text,
  Card,
  Badge,
  Anchor,
  Button,
  Drawer,
  Select,
  NumberInput,
  Textarea,
  Alert,
  Tabs,
} from '@mantine/core'
import Link from 'next/link'
import { IconArrowsTransferDown, IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { createHourTransfer } from '@/actions/hour-transfers'
import { AREAS, ROLES, AREA_LABELS, ROLE_LABELS, type Area, type Role } from '@/lib/matrix'
import { marginColor, consumptionColor } from '@/lib/tokens'
import { formatEur } from '@/lib/margin'

type ProjectRow = {
  id: string
  name: string
  status: string
  totals: { consumed: number; planned: number; pct: number | null }
  marginTotals: { soldCents: number; marginPct: number | null }
}

type TransferRow = {
  id: string
  fromProjectName: string
  toProjectName: string
  area: string
  role: string
  hours: string
  reason: string
  performedByName: string
  performedAt: string
}

type Props = {
  workspaceId: string
  projects: ProjectRow[]
  transfers: TransferRow[]
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  active: 'green',
  paused: 'yellow',
  closed: 'red',
}

export default function WorkspaceTabs({ workspaceId, projects, transfers }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [fromProjectId, setFromProjectId] = useState<string | null>(null)
  const [toProjectId, setToProjectId] = useState<string | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [hours, setHours] = useState<number | string>('')
  const [reason, setReason] = useState('')

  function resetWizard() {
    setFromProjectId(null)
    setToProjectId(null)
    setArea(null)
    setRole(null)
    setHours('')
    setReason('')
    setError(null)
  }

  function handleTransfer() {
    if (!fromProjectId || !toProjectId || !area || !role || !hours || !reason.trim()) {
      setError('Completa todos los campos')
      return
    }
    const hoursNum = typeof hours === 'number' ? hours : parseFloat(hours)
    if (isNaN(hoursNum) || hoursNum <= 0) {
      setError('Las horas deben ser positivas')
      return
    }
    startTransition(async () => {
      const result = await createHourTransfer({ fromProjectId, toProjectId, area, role, hours: hoursNum, reason })
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        notifications.show({ color: 'green', message: 'Horas transferidas · ' + hoursNum + 'h' })
        setDrawerOpen(false)
        resetWizard()
      }
    })
  }

  const activeProjects = projects.filter((p) => p.status !== 'closed')

  return (
    <>
      <Tabs defaultValue="projects" variant="pills">
        <Group justify="space-between" align="center" mb="md">
          <Tabs.List>
            <Tabs.Tab value="projects">Proyectos</Tabs.Tab>
            <Tabs.Tab value="transfers" rightSection={
              transfers.length > 0
                ? <Badge size="xs" variant="light" color="gray" circle>{transfers.length}</Badge>
                : undefined
            }>
              Transferencias
            </Tabs.Tab>
          </Tabs.List>
          <Button
            size="xs"
            leftSection={<IconArrowsTransferDown size={13} />}
            onClick={() => setDrawerOpen(true)}
          >
            Mover horas
          </Button>
        </Group>

        <Tabs.Panel value="projects">
          <Stack gap="sm">
            {projects.length === 0 && (
              <Card>
                <Text size="sm" c="dimmed" ta="center" py="lg">Sin proyectos en este workspace.</Text>
              </Card>
            )}
            {projects.map((p) => {
              const mColor = marginColor(p.marginTotals.marginPct ?? -1)
              const cColor = consumptionColor(p.totals.pct)
              return (
                <Card key={p.id} p="md">
                  <Group justify="space-between" align="flex-start">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" mb={4}>
                        <Anchor component={Link} href={`/projects/${p.id}`} fw={600} size="sm" c="dark">
                          {p.name}
                        </Anchor>
                        <Badge size="xs" color={STATUS_COLOR[p.status] ?? 'gray'} variant="light">
                          {STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        <Text span c={cColor} fw={500} size="xs">
                          {p.totals.consumed.toFixed(1)}h
                        </Text>
                        {p.totals.planned > 0 ? ` / ${p.totals.planned.toFixed(0)}h` : ''}
                        {p.totals.pct !== null ? ` · ${Math.round(p.totals.pct)}%` : ''}
                      </Text>
                    </div>
                    <Group gap="xl">
                      <div style={{ textAlign: 'right' }}>
                        <Text size="xs" c="dimmed">Ingresos</Text>
                        <Text size="sm" fw={600}>{formatEur(p.marginTotals.soldCents)}</Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text size="xs" c="dimmed">Margen</Text>
                        <Text size="sm" fw={600} c={mColor}>
                          {p.marginTotals.marginPct !== null ? `${p.marginTotals.marginPct.toFixed(1)}%` : '—'}
                        </Text>
                      </div>
                    </Group>
                  </Group>
                </Card>
              )
            })}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="transfers">
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Mueve horas no consumidas de un proyecto a otro. Útil cuando un proyecto va sobrado de horas y otro está corto.
            </Text>
            {transfers.length === 0 && (
              <Card>
                <Text size="sm" c="dimmed" ta="center" py="lg">Aún no hay transferencias registradas.</Text>
              </Card>
            )}
            {transfers.map((t) => (
              <Card key={t.id} p="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Group gap={6} mb={2}>
                      <IconArrowsTransferDown size={14} color="var(--mantine-color-gray-5)" />
                      <Text size="sm" fw={500}>
                        {t.fromProjectName} → {t.toProjectName}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Badge size="xs" variant="light" color="gray">
                        {AREA_LABELS[t.area as Area] ?? t.area}
                      </Badge>
                      <Badge size="xs" variant="light" color="gray">
                        {ROLE_LABELS[t.role as Role] ?? t.role}
                      </Badge>
                      <Text size="xs" fw={600}>{parseFloat(t.hours).toFixed(1)}h</Text>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>{t.reason}</Text>
                  </div>
                  <Stack gap={2} align="flex-end">
                    <Text size="xs" c="dimmed">{t.performedByName}</Text>
                    <Text size="xs" c="dimmed">
                      {new Date(t.performedAt).toLocaleDateString('es-ES')}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={drawerOpen}
        onClose={() => { setDrawerOpen(false); resetWizard() }}
        title="Mover horas entre proyectos"
        position="right"
        size="md"
      >
        <Stack gap="sm" pb="md">
          {error && (
            <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Select
            label="Proyecto origen"
            placeholder="Selecciona..."
            data={activeProjects.map((p) => ({ value: p.id, label: p.name }))}
            value={fromProjectId}
            onChange={(v) => { setFromProjectId(v); if (v === toProjectId) setToProjectId(null) }}
            required
          />

          <Select
            label="Proyecto destino"
            placeholder="Selecciona..."
            data={activeProjects.filter((p) => p.id !== fromProjectId).map((p) => ({ value: p.id, label: p.name }))}
            value={toProjectId}
            onChange={setToProjectId}
            required
            disabled={!fromProjectId}
          />

          <Group grow>
            <Select
              label="Área"
              placeholder="Selecciona…"
              data={AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }))}
              value={area}
              onChange={setArea}
              required
            />
            <Select
              label="Rol"
              placeholder="Selecciona…"
              data={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              value={role}
              onChange={setRole}
              required
            />
          </Group>

          <NumberInput
            label="Horas a mover"
            placeholder="Ej. 40"
            value={hours}
            onChange={setHours}
            min={0.5}
            step={1}
            decimalScale={1}
            required
          />

          <Textarea
            label="Motivo"
            placeholder="Ej: Sobrecoste por cambios de scope..."
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            maxLength={500}
            rows={3}
            required
          />

          <Text size="xs" c="dimmed">
            La transferencia es atómica e irreversible. Las horas se mueven de la asignación efectiva del proyecto origen al destino en la misma celda (área × rol).
          </Text>

          <Button onClick={handleTransfer} loading={isPending} mt="xs">
            Confirmar transferencia
          </Button>
        </Stack>
      </Drawer>
    </>
  )
}
