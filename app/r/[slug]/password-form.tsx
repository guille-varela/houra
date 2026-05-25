'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Stack, Title, TextInput, Button, Alert, Paper, Text } from '@mantine/core'
import { verifyReportAccess } from '@/actions/reports'

type Props = { slug: string; orgName: string }

export default function PasswordForm({ slug, orgName }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await verifyReportAccess({ slug, password })
      if (!result.ok) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Paper withBorder p="xl" radius="sm" w="100%" style={{ maxWidth: 380 }}>
        <Stack gap="md">
          <div>
            <Title order={4}>{orgName}</Title>
            <Text size="sm" c="dimmed">Introduce la contraseña para acceder al report.</Text>
          </div>

          {error && (
            <Alert color="red" variant="light">{error}</Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="sm">
              <TextInput
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                disabled={isPending}
                autoFocus
              />
              <Button type="submit" loading={isPending} disabled={!password} fullWidth>
                Acceder
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </div>
  )
}
