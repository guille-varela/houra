'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Stack, Group, Text, Button, ThemeIcon } from '@mantine/core'
import { IconBulb, IconArrowUpRight } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { updateProposalStaffing } from '@/actions/proposals'
import type { MarginSuggestion } from '@/lib/margin-suggestions'

type Props = {
  suggestions: MarginSuggestion[]
  targetPct: number
}

/**
 * F2.11 — Panel inline de sugerencias para acercar el margen al objetivo.
 * Cada sugerencia es una hipótesis editable: se aplica solo al pulsar "Aplicar".
 */
export default function MarginSuggestions({ suggestions, targetPct }: Props) {
  const router = useRouter()
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function apply(s: MarginSuggestion) {
    setApplyingId(`${s.lineId}:${s.kind}`)
    startTransition(async () => {
      const result = await updateProposalStaffing(s.lineId, s.patch)
      if (result.ok) {
        notifications.show({ color: 'green', message: 'Sugerencia aplicada' })
        router.refresh()
      } else {
        notifications.show({ color: 'red', message: result.error })
      }
      setApplyingId(null)
    })
  }

  return (
    <Card withBorder p="md" style={{ background: 'var(--mantine-color-yellow-0)' }}>
      <Group gap="xs" mb="sm">
        <ThemeIcon variant="light" color="yellow" size="sm" radius="xl">
          <IconBulb size={14} />
        </ThemeIcon>
        <Text size="sm" fw={600}>Sugerencias para alcanzar el {targetPct.toFixed(0)}%</Text>
      </Group>
      <Stack gap={6}>
        {suggestions.map((s) => {
          const key = `${s.lineId}:${s.kind}`
          return (
            <Group key={key} justify="space-between" wrap="nowrap" gap="sm">
              <Group gap={6} wrap="nowrap">
                <IconArrowUpRight size={14} style={{ color: 'var(--mantine-color-green-7)', flexShrink: 0 }} />
                <Text size="sm">
                  {s.description}{' '}
                  <Text span size="sm" fw={600} c="green">(→ +{s.ppGain.toFixed(1)}pp)</Text>
                </Text>
              </Group>
              <Button
                size="compact-xs"
                variant="light"
                loading={isPending && applyingId === key}
                disabled={isPending}
                onClick={() => apply(s)}
              >
                Aplicar
              </Button>
            </Group>
          )
        })}
      </Stack>
      <Text size="xs" c="dimmed" mt="sm">
        Son hipótesis sobre las líneas de equipo de esta propuesta. Revisa el resultado tras aplicar.
      </Text>
    </Card>
  )
}
