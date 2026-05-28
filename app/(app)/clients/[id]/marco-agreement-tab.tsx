'use client'

import { useState } from 'react'
import {
  Switch, NumberInput, Group, Text, Stack, Button, Divider,
  Badge, TextInput, Alert,
} from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { updateMarcoAgreement } from '@/actions/clients'

const CATEGORIES = [
  { key: 'head', label: 'Head' },
  { key: 'lead', label: 'Lead' },
  { key: 'senior', label: 'Senior' },
  { key: 'mid', label: 'Mid' },
  { key: 'junior', label: 'Junior' },
  { key: 'trainee', label: 'Trainee' },
] as const

type Client = {
  id: string
  hasMarco: boolean
  marcoStartDate: string | null
  marcoEndDate: string | null
  marcoUsePerRoleRates: boolean
  marcoGlobalRateCents: number | null
  marcoRateByCategory: Partial<Record<string, number | null>> | null
}

function centsToEuros(cents: number | null | undefined): number | undefined {
  if (cents == null) return undefined
  return cents / 100
}

function eurosToCents(euros: number | undefined | null): number | null {
  if (euros == null) return null
  return Math.round(euros * 100)
}

export default function MarcoAgreementTab({
  client,
  isAdmin,
}: {
  client: Client
  isAdmin: boolean
}) {
  const [hasMarco, setHasMarco] = useState(client.hasMarco)
  const [usePerRole, setUsePerRole] = useState(client.marcoUsePerRoleRates)
  const [startDate, setStartDate] = useState(client.marcoStartDate ?? '')
  const [endDate, setEndDate] = useState(client.marcoEndDate ?? '')
  const [globalRate, setGlobalRate] = useState<number | string>(
    centsToEuros(client.marcoGlobalRateCents) ?? '',
  )
  const [perRoleRates, setPerRoleRates] = useState<Record<string, number | ''>>(
    Object.fromEntries(
      CATEGORIES.map(({ key }) => [
        key,
        centsToEuros(client.marcoRateByCategory?.[key] ?? null) ?? '',
      ]),
    ),
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateMarcoAgreement(client.id, {
        hasMarco,
        marcoStartDate: startDate || null,
        marcoEndDate: endDate || null,
        marcoUsePerRoleRates: usePerRole,
        marcoGlobalRateCents: eurosToCents(typeof globalRate === 'number' ? globalRate : parseFloat(globalRate as string) || null),
        marcoRateByCategory: usePerRole
          ? Object.fromEntries(
              CATEGORIES.map(({ key }) => {
                const v = perRoleRates[key]
                const num = typeof v === 'number' ? v : parseFloat(v as string)
                return [key, isNaN(num) ? null : eurosToCents(num)]
              }),
            )
          : null,
      })
      notifications.show({ color: 'green', message: 'Acuerdo marco guardado' })
    } catch {
      notifications.show({ color: 'red', message: 'No se pudo guardar el acuerdo marco' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg" maw={560}>
      {/* Toggle principal */}
      <Group justify="space-between" align="center" p="md" style={{
        borderRadius: 10,
        border: '1px solid var(--h-border)',
        background: 'var(--h-surface-raised)',
      }}>
        <div>
          <Text size="sm" fw={500} style={{ color: 'var(--h-text)' }}>Acuerdo Marco</Text>
          <Text size="xs" c="dimmed">
            Activa si este cliente tiene tarifas negociadas que se aplican a todos sus proyectos
          </Text>
        </div>
        <Switch
          checked={hasMarco}
          onChange={(e) => setHasMarco(e.currentTarget.checked)}
          disabled={!isAdmin}
        />
      </Group>

      {hasMarco && (
        <>
          {/* Fechas de vigencia */}
          <Group grow>
            <TextInput
              label="Inicio del acuerdo"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.currentTarget.value)}
              disabled={!isAdmin}
            />
            <TextInput
              label="Fin del acuerdo"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.currentTarget.value)}
              disabled={!isAdmin}
            />
          </Group>

          <Divider />

          {/* Toggle tarifa global vs. por rol */}
          <Group justify="space-between" align="center">
            <div>
              <Text size="sm" fw={500} style={{ color: 'var(--h-text)' }}>Tarifa por categoría</Text>
              <Text size="xs" c="dimmed">
                Desactivado: una tarifa global para todos los perfiles
              </Text>
            </div>
            <Switch
              checked={usePerRole}
              onChange={(e) => setUsePerRole(e.currentTarget.checked)}
              disabled={!isAdmin}
            />
          </Group>

          {!usePerRole ? (
            <NumberInput
              label="Tarifa global (€/hora)"
              placeholder="Ej: 85"
              value={globalRate}
              onChange={setGlobalRate}
              min={0}
              decimalScale={2}
              suffix=" €/h"
              disabled={!isAdmin}
            />
          ) : (
            <Stack gap="xs">
              <Alert icon={<IconInfoCircle size={14} />} color="blue" variant="light" p="xs">
                <Text size="xs">
                  Deja vacío una categoría para que herede la tarifa global ({globalRate ? `${globalRate} €/h` : 'no definida'})
                </Text>
              </Alert>
              <NumberInput
                label="Tarifa global (base para herencia)"
                placeholder="Ej: 85"
                value={globalRate}
                onChange={setGlobalRate}
                min={0}
                decimalScale={2}
                suffix=" €/h"
                disabled={!isAdmin}
                mb="xs"
              />
              {CATEGORIES.map(({ key, label }) => (
                <Group key={key} align="flex-end" gap="sm">
                  <NumberInput
                    label={label}
                    placeholder="Hereda global"
                    value={perRoleRates[key] ?? ''}
                    onChange={(v) => setPerRoleRates((prev) => ({ ...prev, [key]: typeof v === 'number' ? v : '' }))}
                    min={0}
                    decimalScale={2}
                    suffix=" €/h"
                    style={{ flex: 1 }}
                    disabled={!isAdmin}
                  />
                  {!perRoleRates[key] && globalRate && (
                    <Badge size="xs" variant="outline" color="gray" mb={6}>
                      {globalRate} €/h
                    </Badge>
                  )}
                </Group>
              ))}
            </Stack>
          )}
        </>
      )}

      {isAdmin && (
        <Group justify="flex-end">
          <Button onClick={handleSave} loading={saving} size="sm">
            Guardar
          </Button>
        </Group>
      )}

      {!isAdmin && (
        <Text size="xs" c="dimmed">Solo un admin puede modificar el acuerdo marco.</Text>
      )}
    </Stack>
  )
}
