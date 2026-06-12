'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  Badge,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Alert,
  Divider,
} from '@mantine/core'
import { updateProposal } from '@/actions/proposals'

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

type Props = {
  proposalId: string
  name: string
  clientId: string | null
  projectType: string
  billingModel: string
  targetMarginPercent: string | null
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
  internalNotes: initialNotes,
  clients,
}: Props) {
  const [name, setName] = useState(initialName)
  const [clientId, setClientId] = useState<string | null>(initialClientId)
  const [projectType, setProjectType] = useState<string | null>(initialProjectType)
  const [billingModel, setBillingModel] = useState<string | null>(initialBillingModel)
  const [margin, setMargin] = useState<number | ''>(
    initialMargin ? Number(initialMargin) : '',
  )
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateProposal(proposalId, {
        name: name.trim() || initialName,
        clientId,
        projectType: projectType ?? 'fixed_bag',
        billingModel: billingModel ?? 'hour_bag',
        targetMarginPercent: typeof margin === 'number' ? margin : null,
        internalNotes: notes.trim() || null,
      })
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError('Error al guardar los cambios.')
      }
    })
  }

  return (
    <Stack gap="lg" style={{ maxWidth: 560 }}>
      <TextInput
        label="Nombre"
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

      <Group grow>
        <Select
          label="Tipo de proyecto"
          data={PROJECT_TYPE_OPTIONS}
          value={projectType}
          onChange={setProjectType}
        />
        <Select
          label="Modelo de facturación"
          data={BILLING_MODEL_OPTIONS}
          value={billingModel}
          onChange={setBillingModel}
        />
      </Group>

      <NumberInput
        label="Margen objetivo (%)"
        placeholder="Ej: 35"
        value={margin}
        onChange={(v) => setMargin(typeof v === 'number' ? v : '')}
        min={0}
        max={100}
        suffix="%"
        style={{ maxWidth: 200 }}
      />

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
