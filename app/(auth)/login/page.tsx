'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stack, Title, TextInput, PasswordInput, Button, Alert, Text } from '@mantine/core'
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
    <Stack maw={400} mx="auto" mt={80} px="md">
      <Title order={2}>Houra</Title>
      <Text c="dimmed" size="sm">
        Registra tu jornada
      </Text>

      {error && (
        <Alert color="red" variant="light">
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
          />
          <PasswordInput
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" loading={loading} fullWidth mt="xs">
            Entrar
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}
