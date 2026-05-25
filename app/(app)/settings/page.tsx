import { redirect } from 'next/navigation'
import { Stack, Title, Text, Anchor } from '@mantine/core'
import Link from 'next/link'
import { getCurrentPerson } from '@/lib/auth-helpers'

export default async function SettingsPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  if (person.appRole !== 'admin') redirect('/today')

  return (
    <Stack p="md" gap="md">
      <Title order={3}>Configuración</Title>
      <Stack gap="xs">
        <Anchor component={Link} href="/settings/rates" size="sm">
          Tarifas (cost &amp; sold) — Organización
        </Anchor>
      </Stack>
      <Text size="xs" c="dimmed">
        Más configuración en fases posteriores.
      </Text>
    </Stack>
  )
}
