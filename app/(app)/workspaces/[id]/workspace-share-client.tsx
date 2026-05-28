'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  Badge,
  Anchor,
  Alert,
  CopyButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { shareWithCommittee } from '@/actions/reports'

type ExistingReport = { id: string; slug: string; status: string; createdAt: string }

type Props = {
  workspaceId: string
  existingReports: ExistingReport[]
}

export default function WorkspaceShareClient({ workspaceId, existingReports }: Props) {
  const [reports, setReports] = useState<ExistingReport[]>(existingReports)
  const [newSlug, setNewSlug] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  function handleShare() {
    startTransition(async () => {
      const result = await shareWithCommittee(workspaceId)
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        setNewSlug(result.slug)
        setReports((prev) => [
          { id: result.slug, slug: result.slug, status: 'open', createdAt: new Date().toISOString() },
          ...prev,
        ])
      }
    })
  }

  return (
    <Stack gap="xs" align="flex-end">
      <Button size="sm" loading={isPending} onClick={handleShare}>
        Compartir con comité
      </Button>

      {newSlug && (
        <Alert color="green" variant="light" w={320}>
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" style={{ wordBreak: 'break-all' }}>{origin}/r/{newSlug}</Text>
            <CopyButton value={`${origin}/r/${newSlug}`}>
              {({ copied, copy }) => (
                <Button size="xs" variant="light" color={copied ? 'green' : 'gray'} onClick={copy}>
                  {copied ? '✓' : 'Copiar'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Alert>
      )}

      {reports.filter(r => r.status === 'open').length > 0 && (
        <Stack gap={4} align="flex-end">
          {reports.filter(r => r.status === 'open').map(r => (
            <Group key={r.id} gap="xs">
              <Anchor href={`/r/${r.slug}`} size="xs" target="_blank">/r/{r.slug}</Anchor>
              <Badge size="xs" color="green" variant="light">Activo</Badge>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
