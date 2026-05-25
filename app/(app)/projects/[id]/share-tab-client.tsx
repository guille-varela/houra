'use client'

import { useState, useTransition } from 'react'
import {
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Alert,
  Paper,
  Badge,
  ActionIcon,
  Tooltip,
  CopyButton,
  Anchor,
  Divider,
} from '@mantine/core'
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
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [newSlug, setNewSlug] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  function handleCreate() {
    setError(null)
    setNewSlug(null)
    startTransition(async () => {
      const result = await createReport({
        scope: 'project',
        scopeId: projectId,
        password: password || undefined,
      })
      if (!result.ok) {
        setError(result.error)
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
        setError(result.error)
      } else {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'closed' } : r)))
      }
    })
  }

  return (
    <Stack gap="md">
      {/* Create new report */}
      <Paper withBorder p="md" radius="sm">
        <Stack gap="sm">
          <Text size="sm" fw={600}>Crear nuevo link de acceso</Text>
          <TextInput
            label="Contraseña (opcional)"
            placeholder="Deja vacío para acceso libre"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            disabled={isPending}
          />
          {error && (
            <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {newSlug && (
            <Alert color="green" variant="light">
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
          <Button size="sm" loading={isPending} onClick={handleCreate} style={{ alignSelf: 'flex-start' }}>
            Generar link
          </Button>
        </Stack>
      </Paper>

      {/* Existing reports */}
      {reports.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={600} c="dimmed">Links activos</Text>
          {reports.map((r) => (
            <Paper key={r.id} withBorder p="sm" radius="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Anchor href={`/r/${r.shareUrlSlug}`} size="sm" target="_blank">
                      /r/{r.shareUrlSlug}
                    </Anchor>
                    {r.hasPassword && (
                      <Badge size="xs" variant="outline" color="gray">🔒 con contraseña</Badge>
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
                        <ActionIcon size="sm" onClick={copy} color={copied ? 'green' : 'gray'}>
                          📋
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  {r.status === 'open' && (
                    <Tooltip label="Cerrar acceso">
                      <ActionIcon
                        size="sm"
                        color="red"
                        loading={isPending}
                        onClick={() => handleClose(r.id)}
                      >
                        ✕
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      {reports.length === 0 && !newSlug && (
        <Text size="sm" c="dimmed">Sin links compartidos todavía.</Text>
      )}
    </Stack>
  )
}
