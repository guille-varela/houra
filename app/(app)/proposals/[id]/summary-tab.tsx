'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Group,
  Button,
  Badge,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Alert,
  Divider,
  Switch,
  SimpleGrid,
  Card,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { updateProposal } from '@/actions/proposals'

// Modelos de proyecto que requieren definir una bolsa de horas total (F2.2)
const BAG_PROJECT_TYPES = ['fixed_bag', 'renewable_bag']

const BILLING_MODEL_OPTIONS = [
  { value: 'hour_bag', label: 'Bolsa de horas' },
  { value: 'monthly_fee', label: 'Fee mensual' },
  { value: 'by_phase', label: 'Por entregable' },
]

const PROJECT_TYPE_OPTIONS = [
  { value: 'fixed_bag', label: 'Bolsa fija' },
  { value: 'renewable_bag', label: 'Bolsa renovable' },
  { value: 'ongoing_capacity', label: 'Capacidad continua' },
]

// F3.1 — presets que unifican tipo de proyecto + modelo de facturación
const PROJECT_PRESETS = [
  { id: 'fixed_hours', icon: '🎯', label: 'Bolsa de horas fija', description: 'Horas cerradas, facturación por hitos', projectType: 'fixed_bag', billingModel: 'hour_bag' },
  { id: 'renewable_monthly', icon: '🔄', label: 'Bolsa renovable mensual', description: 'Se renueva cada mes, fee mensual', projectType: 'renewable_bag', billingModel: 'monthly_fee' },
  { id: 'by_deliverable', icon: '📦', label: 'Tarifa por entregable', description: 'Precio cerrado por entregable', projectType: 'fixed_bag', billingModel: 'by_phase' },
  { id: 'ongoing', icon: '♾️', label: 'Capacidad continua', description: 'Equipo dedicado, fee mensual', projectType: 'ongoing_capacity', billingModel: 'monthly_fee' },
] as const

function findPreset(projectType: string | null, billingModel: string | null) {
  return PROJECT_PRESETS.find((p) => p.projectType === projectType && p.billingModel === billingModel) ?? null
}

type Props = {
  proposalId: string
  name: string
  clientId: string | null
  projectType: string
  billingModel: string
  targetMarginPercent: string | null
  useDefaultMargin: boolean
  totalBagHours: string | null
  orgDefaultMargin: string
  internalNotes: string | null
  clients: Array<{ id: string; name: string; hasMarco: boolean }>
}

export default function SummaryTab({
  proposalId,
  name: initialName,
  clientId: initialClientId,
  projectType: initialProjectType,
  billingModel: initialBillingModel,
  targetMarginPercent: initialMargin,
  useDefaultMargin: initialUseDefaultMargin,
  totalBagHours: initialBagHours,
  orgDefaultMargin,
  internalNotes: initialNotes,
  clients,
}: Props) {
  const [name, setName] = useState(initialName)
  const [clientId, setClientId] = useState<string | null>(initialClientId)
  const [projectType, setProjectType] = useState<string | null>(initialProjectType)
  const [billingModel, setBillingModel] = useState<string | null>(initialBillingModel)
  // F3.1 — si la combinación inicial no encaja en un preset, arranca en modo personalizar
  const [customMode, setCustomMode] = useState(() => findPreset(initialProjectType, initialBillingModel) === null)
  const [useDefaultMargin, setUseDefaultMargin] = useState(initialUseDefaultMargin)
  const [margin, setMargin] = useState<number | ''>(
    initialMargin ? Number(initialMargin) : '',
  )
  const [bagHours, setBagHours] = useState<number | ''>(
    initialBagHours ? Number(initialBagHours) : '',
  )
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const showBagHours = projectType != null && BAG_PROJECT_TYPES.includes(projectType)
  const effectiveMargin = useDefaultMargin ? Number(orgDefaultMargin) : margin
  const activePreset = customMode ? null : findPreset(projectType, billingModel)

  function selectPreset(preset: (typeof PROJECT_PRESETS)[number]) {
    setProjectType(preset.projectType)
    setBillingModel(preset.billingModel)
    setCustomMode(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateProposal(proposalId, {
        name: name.trim() || initialName,
        clientId,
        projectType: projectType ?? 'fixed_bag',
        billingModel: billingModel ?? 'hour_bag',
        targetMarginPercent: useDefaultMargin
          ? Number(orgDefaultMargin)
          : (typeof margin === 'number' ? margin : null),
        useDefaultMargin,
        totalBagHours: showBagHours && typeof bagHours === 'number' ? bagHours : null,
        internalNotes: notes.trim() || null,
      })
      if (result.ok) {
        notifications.show({ color: 'green', message: 'Propuesta actualizada · ' + (name.trim() || initialName) })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        notifications.show({ color: 'red', message: 'No se pudo actualizar la propuesta' })
        setError('Error al guardar los cambios.')
      }
    })
  }

  return (
    <Stack gap="lg" style={{ maxWidth: 560 }}>
      <TextInput
        label="Nombre"
        placeholder="Ej. Iberdrola Web Consejero Q3 2026"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />

      <Select
        label="Cliente"
        placeholder="Sin cliente asignado"
        data={clients.map((c) => ({ value: c.id, label: c.name }))}
        value={clientId}
        onChange={setClientId}
        clearable
        renderOption={({ option }) => {
          const c = clients.find((x) => x.id === option.value)
          return (
            <Group justify="space-between" gap="xs" w="100%" wrap="nowrap">
              <span>{option.label}</span>
              {c?.hasMarco && (
                <Badge size="xs" variant="light" color="blue">Acuerdo Marco</Badge>
              )}
            </Group>
          )
        }}
      />

      <Stack gap="xs">
        <Text size="sm" fw={500}>Modelo de proyecto</Text>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
          {PROJECT_PRESETS.map((preset) => {
            const active = activePreset?.id === preset.id
            return (
              <Card
                key={preset.id}
                withBorder
                p="sm"
                onClick={() => selectPreset(preset)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPreset(preset) } }}
                style={{
                  cursor: 'pointer',
                  borderColor: active ? 'var(--mantine-color-blue-5)' : undefined,
                  background: active ? 'var(--mantine-color-blue-0)' : undefined,
                }}
              >
                <Group gap="xs" wrap="nowrap" align="flex-start">
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{preset.icon}</span>
                  <div>
                    <Text size="sm" fw={500}>{preset.label}</Text>
                    <Text size="xs" c="dimmed">{preset.description}</Text>
                  </div>
                </Group>
              </Card>
            )
          })}
          <Card
            withBorder
            p="sm"
            onClick={() => setCustomMode(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCustomMode(true) } }}
            style={{
              cursor: 'pointer',
              borderColor: customMode ? 'var(--mantine-color-blue-5)' : undefined,
              background: customMode ? 'var(--mantine-color-blue-0)' : undefined,
            }}
          >
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚙️</span>
              <div>
                <Text size="sm" fw={500}>Personalizar…</Text>
                <Text size="xs" c="dimmed">Elige tipo y facturación por separado</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        {customMode && (
          <Group grow mt="xs">
            <Select
              label="Tipo de proyecto"
              placeholder="Selecciona…"
              data={PROJECT_TYPE_OPTIONS}
              value={projectType}
              onChange={setProjectType}
            />
            <Select
              label="Modelo de facturación"
              placeholder="Selecciona…"
              data={BILLING_MODEL_OPTIONS}
              value={billingModel}
              onChange={setBillingModel}
            />
          </Group>
        )}
      </Stack>

      {showBagHours && (
        <NumberInput
          label="Horas totales de la bolsa"
          description="Horas contratadas en total para este proyecto"
          placeholder="Ej. 200"
          value={bagHours}
          onChange={(v) => setBagHours(typeof v === 'number' ? v : '')}
          min={0}
          suffix="h"
          style={{ maxWidth: 240 }}
        />
      )}

      <Stack gap={6} style={{ maxWidth: 320 }}>
        <Switch
          label="Usar margen estándar de empresa"
          checked={useDefaultMargin}
          onChange={(e) => setUseDefaultMargin(e.currentTarget.checked)}
        />
        <NumberInput
          label="Margen objetivo (%)"
          description={useDefaultMargin ? `Estándar de la organización: ${orgDefaultMargin}%` : undefined}
          placeholder="Ej: 35"
          value={effectiveMargin}
          onChange={(v) => setMargin(typeof v === 'number' ? v : '')}
          disabled={useDefaultMargin}
          min={0}
          max={100}
          suffix="%"
          style={{ maxWidth: 200 }}
        />
      </Stack>

      <Divider />

      <Textarea
        label="Notas internas"
        placeholder="Contexto de la oportunidad, restricciones, observaciones…"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        minRows={3}
        autosize
      />

      {error && (
        <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Button
        size="sm"
        variant={saved ? 'filled' : 'light'}
        {...(saved ? { color: 'green' as const } : {})}
        loading={isPending}
        onClick={handleSave}
        style={{ alignSelf: 'flex-start' }}
      >
        {saved ? 'Guardado' : 'Guardar cambios'}
      </Button>
    </Stack>
  )
}
