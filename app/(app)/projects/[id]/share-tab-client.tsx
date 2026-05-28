'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Alert,
  Card,
  Badge,
  ActionIcon,
  Tooltip,
  CopyButton,
  Anchor,
} from '@mantine/core'
import { IconLink, IconCopy, IconX, IconLock } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { createReport, closeReport } from '@/actions/reports'

type Report = {
  id: string
  shareUrlSlug: string
  status: string
  hasPassword: boolean
  createdAt: string
}

type Props = {
  projectId: string
  reports: Report[]
}

export default function ShareTabClient({ projectId, reports: initialReports }: Props) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [password, setPassword] = useState('')
  const [isPending, startTransition] = useTransition()
  const [newSlug, setNewSlug] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  function handleCreate() {
    setNewSlug(null)
    startTransition(async () => {
      const result = await createReport({
        scope: 'project',
        scopeId: projectId,
        password: password || undefined,
      })
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        setNewSlug(result.slug)
        setPassword('')
        setReports((prev) => [
          {
            id: result.slug,
            shareUrlSlug: result.slug,
            status: 'open',
            hasPassword: !!password,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ])
      }
    })
  }

  function handleClose(id: string) {
    startTransition(async () => {
      const result = await closeReport(id)
      if (!result.ok) {
        notifications.show({ color: 'red', title: 'Error', message: result.error })
      } else {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'closed' } : r)))
      }
    })
  }

  return (
    <Stack gap="xl">
      <Card p="lg">
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Nuevo link de acceso
          </Text>
          <TextInput
            label="Contraseña (opcional)"
            placeholder="Deja vacío para acceso libre"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            disabled={isPending}
          />
          {newSlug && (
            <Alert color="green" variant="light" icon={<IconLink size={16} />}>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" style={{ wordBreak: 'break-all' }}>
                  {origin}/r/{newSlug}
                </Text>
                <CopyButton value={`${origin}/r/${newSlug}`}>
                  {({ copied, copy }) => (
                    <Button size="xs" variant="light" color={copied ? 'green' : 'gray'} onClick={copy}>
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Alert>
          )}
          <Button
            size="sm"
            loading={isPending}
            onClick={handleCreate}
            leftSection={<IconLink size={14} />}
            style={{ alignSelf: 'flex-start' }}
          >
            Generar link
          </Button>
        </Stack>
      </Card>

      {reports.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Links activos
          </Text>
          {reports.map((r) => (
            <Card key={r.id} p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Anchor href={`/r/${r.shareUrlSlug}`} size="sm" target="_blank">
                      /r/{r.shareUrlSlug}
                    </Anchor>
                    {r.hasPassword && (
                      <Badge size="xs" variant="light" color="gray" leftSection={<IconLock size={10} />}>
                        Con contraseña
                      </Badge>
                    )}
                    <Badge
                      size="xs"
                      variant="light"
                      color={r.status === 'open' ? 'green' : 'gray'}
                    >
                      {r.status === 'open' ? 'Activo' : 'Cerrado'}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {new Date(r.createdAt).toLocaleDateString('es-ES')}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <CopyButton value={`${origin}/r/${r.shareUrlSlug}`}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copiado' : 'Copiar URL'}>
                        <ActionIcon size="md" variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy}>
                          <IconCopy size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  {r.status === 'open' && (
                    <Tooltip label="Cerrar acceso">
                      <ActionIcon
                        size="md"
                        variant="subtle"
                        color="red"
                        loading={isPending}
                        onClick={() => handleClose(r.id)}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {reports.length === 0 && !newSlug && (
        <Card>
          <Text size="sm" c="dimmed" ta="center" py="md">
            Sin links compartidos todavía.
          </Text>
        </Card>
      )}
    </Stack>
  )
}
