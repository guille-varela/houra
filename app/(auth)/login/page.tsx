'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stack, TextInput, PasswordInput, Button, Alert, Text } from '@mantine/core'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(result.error.message ?? 'Credenciales incorrectas.')
        return
      }
      router.push('/today')
    } catch {
      setError('Error de red. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: '#fafafa',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Wordmark */}
        <Stack gap={4} mb="xl">
          <Text
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--mantine-color-dark-9)',
            }}
          >
            Houra
          </Text>
          <Text size="sm" c="dimmed">
            Registra tu jornada
          </Text>
        </Stack>

        {error && (
          <Alert color="red" variant="light" radius="lg" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              autoComplete="email"
              autoFocus
              size="md"
            />
            <PasswordInput
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              autoComplete="current-password"
              size="md"
            />
            <Button type="submit" loading={loading} fullWidth mt="xs" size="md">
              Entrar
            </Button>
          </Stack>
        </form>
      </div>
    </div>
  )
}
