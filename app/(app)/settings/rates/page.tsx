import { redirect } from 'next/navigation'
import { and, isNull } from 'drizzle-orm'
import { Stack, Title, Text } from '@mantine/core'
import { db } from '@/lib/db'
import { rates } from '@/db/schema'
import { getCurrentPerson } from '@/lib/auth-helpers'
import RatesClient from './rates-client'

export default async function RatesPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  if (person.appRole !== 'admin') redirect('/today')

  // Org-level rates: all scope FKs null
  const orgRates = await db
    .select()
    .from(rates)
    .where(
      and(
        isNull(rates.workspaceId),
        isNull(rates.projectId),
        isNull(rates.personId),
      ),
    )
    .orderBy(rates.area, rates.role)

  return (
    <Stack p="md" gap="md">
      <div>
        <Title order={3}>Tarifas — Organización</Title>
        <Text size="xs" c="dimmed">
          Tarifas base para toda la organización. Se aplican cuando no hay override de workspace, proyecto o persona.
        </Text>
      </div>
      <RatesClient rates={orgRates} />
    </Stack>
  )
}
