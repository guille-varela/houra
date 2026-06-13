import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Stack, Text } from '@mantine/core'
import { db } from '@/lib/db'
import { organizations } from '@/db/schema'
import { getCurrentPerson } from '@/lib/auth-helpers'
import BackLink from '@/components/ui/back-link'
import OrganizationClient from './organization-client'

export default async function OrganizationSettingsPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  if (person.appRole !== 'admin') redirect('/today')

  const [org] = await db
    .select({
      defaultTargetMarginPct: organizations.defaultTargetMarginPct,
      proposalExpiryDays: organizations.proposalExpiryDays,
    })
    .from(organizations)
    .where(eq(organizations.id, person.organizationId))
    .limit(1)

  return (
    <Stack p="md" gap="lg">
      <BackLink href="/settings" label="Configuración" />
      <div>
        <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Organización
        </Text>
        <Text size="xs" c="dimmed">Ajustes por defecto de propuestas y márgenes</Text>
      </div>
      <OrganizationClient
        defaultTargetMarginPct={org?.defaultTargetMarginPct ? Number(org.defaultTargetMarginPct) : 40}
        proposalExpiryDays={org?.proposalExpiryDays ?? 90}
      />
    </Stack>
  )
}
