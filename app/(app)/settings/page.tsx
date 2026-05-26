import { redirect } from 'next/navigation'
import { Stack, Text, Card, Group } from '@mantine/core'
import Link from 'next/link'
import { IconChevronRight, IconCurrencyEuro } from '@tabler/icons-react'
import { getCurrentPerson } from '@/lib/auth-helpers'

export default async function SettingsPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  if (person.appRole !== 'admin') redirect('/today')

  return (
    <Stack p="md" gap="xl">
      <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
        Configuración
      </Text>

      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Organización
        </Text>
        <Card component={Link} href="/settings/rates" p="md" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <IconCurrencyEuro size={18} stroke={1.5} color="var(--mantine-color-gray-6)" />
              <div>
                <Text size="sm" fw={500}>Tarifas</Text>
                <Text size="xs" c="dimmed">Cost &amp; sold por área y rol</Text>
              </div>
            </Group>
            <IconChevronRight size={16} color="var(--mantine-color-gray-4)" />
          </Group>
        </Card>
      </Stack>

      <Text size="xs" c="dimmed">
        Más configuración en fases posteriores.
      </Text>
    </Stack>
  )
}
