'use client'

import { useState, useTransition } from 'react'
import {
  Card,
  Group,
  Stack,
  Text,
  Select,
  Button,
  Badge,
  Switch,
  NumberInput,
  Modal,
  Alert,
  Tooltip,
} from '@mantine/core'
import { MonthPickerInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { IconCalendarPlus, IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { AREA_LABELS } from '@/lib/insights-filters'
import type { AutoFillScopeResult, ConfigurableAssignment } from '@/lib/auto-fill-data'
import type { AutoFillMode } from '@/lib/auto-fill'
import {
  previewAutoFill,
  commitAutoFill,
  revertAutoFill,
  setAssignmentDedication,
} from '@/actions/auto-fill'

type Props = {
  assignments: ConfigurableAssignment[]
  projects: Array<{ id: string; name: string }>
}

const MODE_LABELS: Record<AutoFillMode, string> = {
  percent: 'Porcentaje',
  monthly_hours: 'Horas/mes',
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthToPeriod(ym: string): { periodStart: string; periodEnd: string } {
  const [y, m] = ym.split('-').map(Number) as [number, number]
  const last = new Date(y, m, 0).getDate()
  return { periodStart: `${ym}-01`, periodEnd: `${ym}-${String(last).padStart(2, '0')}` }
}

function fmtEur(cents: number): string {
  return `${(cents / 100).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`
}
function fmtH(h: number): string {
  return `${h.toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`
}
function areaLabel(a: string): string {
  return AREA_LABELS[a] ?? a
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--mantine-color-dimmed)',
  fontWeight: 600,
}
const tdStyle: React.CSSProperties = { padding: '6px 10px', fontSize: 13 }
const numTd: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function AutoFillClient({ assignments, projects }: Props) {
  const [month, setMonth] = useState(currentMonth())
  const [scopeProject, setScopeProject] = useState<string | null>(null)
  const [preview, setPreview] = useState<AutoFillScopeResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lastRunId, setLastRunId] = useState<string | null>(null)
  const [isPreviewing, startPreview] = useTransition()
  const [isCommitting, startCommit] = useTransition()
  const [isReverting, startRevert] = useTransition()

  function runPreview() {
    const { periodStart, periodEnd } = monthToPeriod(month)
    const scope = scopeProject ? { projectId: scopeProject } : {}
    setLastRunId(null)
    startPreview(async () => {
      const res = await previewAutoFill({ periodStart, periodEnd, scope })
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error })
        setPreview(null)
        return
      }
      setPreview(res.result)
    })
  }

  function runCommit() {
    const { periodStart, periodEnd } = monthToPeriod(month)
    const scope = scopeProject ? { projectId: scopeProject } : {}
    startCommit(async () => {
      const res = await commitAutoFill({ periodStart, periodEnd, scope })
      setConfirmOpen(false)
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error })
        return
      }
      setLastRunId(res.runId)
      setPreview(null)
      notifications.show({
        color: 'teal',
        icon: <IconCheck size={16} />,
        message: `Autorelleno confirmado: ${res.inserted} entradas creadas${res.skipped ? ` (${res.skipped} omitidas)` : ''}.`,
      })
    })
  }

  function runRevert() {
    if (!lastRunId) return
    startRevert(async () => {
      const res = await revertAutoFill(lastRunId)
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error })
        return
      }
      setLastRunId(null)
      notifications.show({ color: 'gray', message: 'Autorelleno deshecho.' })
    })
  }

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }))
  const validCount = preview?.rows.filter((r) => !r.error && r.entries.length > 0).length ?? 0

  return (
    <Stack gap="lg">
      {/* ── Calcular y confirmar ──────────────────────────────────────────── */}
      <Card withBorder p="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <MonthPickerInput
            label="Mes"
            valueFormat="MMMM YYYY"
            value={month ? `${month}-01` : null}
            onChange={(v) => v && setMonth(v.slice(0, 7))}
            size="sm"
            w={200}
          />
          <Select
            label="Proyecto"
            placeholder="Todos los proyectos"
            data={projectOptions}
            value={scopeProject}
            onChange={setScopeProject}
            clearable
            searchable
            w={240}
            size="sm"
          />
          <Button
            leftSection={<IconCalendarPlus size={16} />}
            onClick={runPreview}
            loading={isPreviewing}
          >
            Calcular preview
          </Button>
          {preview && validCount > 0 && (
            <Button
              variant="filled"
              color="teal"
              onClick={() => setConfirmOpen(true)}
              loading={isCommitting}
            >
              Confirmar autorelleno
            </Button>
          )}
          {lastRunId && (
            <Button variant="default" onClick={runRevert} loading={isReverting}>
              Deshacer último autorelleno
            </Button>
          )}
        </Group>

        {preview && (
          <Stack gap="sm" mt="md">
            <Group gap="lg">
              <Text size="sm">
                <b>{preview.totals.assignments}</b> asignaciones · <b>{preview.totals.entries}</b>{' '}
                entradas · <b>{fmtH(preview.totals.hours)}</b> · ingresos{' '}
                <b>{fmtEur(preview.totals.revenueCents)}</b>
                {preview.totals.withErrors > 0 && (
                  <Text span c="red">
                    {' '}
                    · {preview.totals.withErrors} con error
                  </Text>
                )}
              </Text>
            </Group>

            {preview.rows.length === 0 ? (
              <Alert color="gray" variant="light">
                No hay asignaciones con autorelleno habilitado en este alcance. Configúralas abajo.
              </Alert>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                      <th style={thStyle}>Persona</th>
                      <th style={thStyle}>Proyecto</th>
                      <th style={thStyle}>Área</th>
                      <th style={thStyle}>Modo</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Objetivo</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Manual</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>A rellenar</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Entradas</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Ingresos</th>
                      <th style={thStyle}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr
                        key={r.assignmentId}
                        style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}
                      >
                        <td style={tdStyle}>{r.personName}</td>
                        <td style={tdStyle}>{r.projectName}</td>
                        <td style={tdStyle}>{areaLabel(r.area)}</td>
                        <td style={tdStyle}>{MODE_LABELS[r.mode]}</td>
                        <td style={numTd}>{fmtH(r.targetHours)}</td>
                        <td style={numTd}>{fmtH(r.manualHours)}</td>
                        <td style={numTd}>{fmtH(r.filledHours)}</td>
                        <td style={numTd}>{r.entries.length}</td>
                        <td style={numTd}>{fmtEur(r.revenueCents)}</td>
                        <td style={tdStyle}>
                          {r.error ? (
                            <Tooltip label={r.error} multiline w={240}>
                              <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                                Error
                              </Badge>
                            </Tooltip>
                          ) : r.warnings.length > 0 ? (
                            <Tooltip label={r.warnings.join(' · ')} multiline w={260}>
                              <Badge color="orange" variant="light">
                                {r.warnings.length} aviso{r.warnings.length > 1 ? 's' : ''}
                              </Badge>
                            </Tooltip>
                          ) : (
                            <Badge color="teal" variant="light">
                              OK
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Stack>
        )}
      </Card>

      {/* ── Configurar dedicaciones ───────────────────────────────────────── */}
      <Card withBorder p="md">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }} mb="sm">
          Configurar dedicaciones
        </Text>
        {assignments.length === 0 ? (
          <Text size="sm" c="dimmed">
            No hay asignaciones activas que configurar.
          </Text>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                  <th style={thStyle}>Persona</th>
                  <th style={thStyle}>Proyecto</th>
                  <th style={thStyle}>Auto</th>
                  <th style={thStyle}>Modo</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Área</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <DedicationRow key={a.assignmentId} assignment={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar autorelleno"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Se crearán <b>{preview?.totals.entries ?? 0}</b> entradas auto-generadas
            ({fmtH(preview?.totals.hours ?? 0)}, ingresos {fmtEur(preview?.totals.revenueCents ?? 0)})
            para <b>{validCount}</b> asignaciones en {month}. Las entradas auto previas del periodo se
            reemplazan; las manuales se respetan.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button color="teal" onClick={runCommit} loading={isCommitting}>
              Confirmar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

// ─── Fila editable de configuración de dedicación ─────────────────────────────────

function DedicationRow({ assignment }: { assignment: ConfigurableAssignment }) {
  const [enabled, setEnabled] = useState(assignment.autoFillEnabled)
  const [mode, setMode] = useState<AutoFillMode | null>(assignment.autoFillMode)
  const [percent, setPercent] = useState<number | ''>(
    assignment.dedicationPercent ? parseFloat(assignment.dedicationPercent) : '',
  )
  const [hours, setHours] = useState<number | ''>(
    assignment.monthlyTargetHours ? parseFloat(assignment.monthlyTargetHours) : '',
  )
  const [area, setArea] = useState<string | null>(assignment.autoFillArea)
  const [isSaving, startSave] = useTransition()

  function save() {
    startSave(async () => {
      const res = await setAssignmentDedication({
        assignmentId: assignment.assignmentId,
        autoFillEnabled: enabled,
        autoFillMode: mode,
        dedicationPercent: mode === 'percent' && percent !== '' ? Number(percent) : null,
        monthlyTargetHours: mode === 'monthly_hours' && hours !== '' ? Number(hours) : null,
        autoFillArea: area,
      })
      notifications.show(
        res.ok
          ? { color: 'teal', message: 'Dedicación guardada.' }
          : { color: 'red', message: res.error },
      )
    })
  }

  const areaOptions = assignment.allowedAreas.map((a) => ({ value: a, label: areaLabel(a) }))

  return (
    <tr style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
      <td style={tdStyle}>{assignment.personName}</td>
      <td style={tdStyle}>{assignment.projectName}</td>
      <td style={tdStyle}>
        <Switch checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} size="sm" />
      </td>
      <td style={tdStyle}>
        <Select
          data={[
            { value: 'percent', label: MODE_LABELS.percent },
            { value: 'monthly_hours', label: MODE_LABELS.monthly_hours },
          ]}
          value={mode}
          onChange={(v) => setMode(v as AutoFillMode | null)}
          disabled={!enabled}
          placeholder="—"
          w={130}
          size="xs"
        />
      </td>
      <td style={tdStyle}>
        {mode === 'monthly_hours' ? (
          <NumberInput
            value={hours}
            onChange={(v) => setHours(typeof v === 'number' ? v : '')}
            disabled={!enabled}
            min={0}
            step={1}
            suffix=" h"
            w={110}
            size="xs"
          />
        ) : (
          <NumberInput
            value={percent}
            onChange={(v) => setPercent(typeof v === 'number' ? v : '')}
            disabled={!enabled || mode !== 'percent'}
            min={0}
            max={100}
            step={5}
            suffix=" %"
            w={110}
            size="xs"
          />
        )}
      </td>
      <td style={tdStyle}>
        <Select
          data={areaOptions}
          value={area}
          onChange={setArea}
          disabled={!enabled}
          placeholder="Primaria"
          clearable
          w={130}
          size="xs"
        />
      </td>
      <td style={tdStyle}>
        <Button size="xs" variant="light" onClick={save} loading={isSaving}>
          Guardar
        </Button>
      </td>
    </tr>
  )
}
