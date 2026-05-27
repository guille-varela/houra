import { redirect } from 'next/navigation'
import { eq, sql } from 'drizzle-orm'
import { Stack, Text, Card, Group, Badge } from '@mantine/core'
import { AnchorLink } from '@/components/ui/anchor-link'
import { db } from '@/lib/db'
import { persons, timeEntries } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Manager', contributor: 'Contributor',
}

const CATEGORY_LABELS: Record<string, string> = {
  trainee: 'Trainee', junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead', head: 'Head',
}

const AREA_LABELS: Record<string, string> = {
  research: 'Research', ux: 'UX', ui: 'UI',
}

export default async function PeoplePage() {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try {
    actor = await requireRole('admin')
  } catch {
    redirect('/today')
  }

  const rows = await db
    .select({
      id: persons.id,
      name: persons.name,
      email: persons.email,
      appRole: persons.appRole,
      professionalCategory: persons.professionalCategory,
      primaryArea: persons.primaryArea,
      deactivatedAt: persons.deactivatedAt,
      anonymizedAt: persons.anonymizedAt,
      lastEntryDate: sql<string | null>`MAX(${timeEntries.date})`,
    })
    .from(persons)
    .leftJoin(timeEntries, eq(timeEntries.personId, persons.id))
    .where(eq(persons.organizationId, actor.organizationId))
    .groupBy(persons.id)
    .orderBy(persons.deactivatedAt, persons.appRole, persons.name)

  const active = rows.filter((r) => !r.deactivatedAt)
  const inactive = rows.filter((r) => r.deactivatedAt)

  function statusBadge(row: typeof rows[0]) {
    if (row.anonymizedAt) return <Badge size="xs" color="red" variant="light">Anonimizado</Badge>
    if (row.deactivatedAt) return <Badge size="xs" color="gray" variant="light">Desactivado</Badge>
    return <Badge size="xs" color="green" variant="light">Activo</Badge>
  }

  function PersonCard({ row }: { row: typeof rows[0] }) {
    return (
      <Card p="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" mb={4}>
              <AnchorLink href={`/people/${row.id}`} fw={600} size="sm" c="dark">
                {row.name}
              </AnchorLink>
              {statusBadge(row)}
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">{row.email}</Text>
              <Text size="xs" c="dimmed">·</Text>
              <Text size="xs" c="dimmed">{CATEGORY_LABELS[row.professionalCategory] ?? row.professionalCategory}</Text>
              <Text size="xs" c="dimmed">·</Text>
              <Text size="xs" c="dimmed">{AREA_LABELS[row.primaryArea] ?? row.primaryArea}</Text>
            </Group>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Badge size="xs" variant="light" color="gray">{ROLE_LABELS[row.appRole] ?? row.appRole}</Badge>
            {row.lastEntryDate && (
              <Text size="xs" c="dimmed" mt={4}>Última entrada: {row.lastEntryDate}</Text>
            )}
          </div>
        </Group>
      </Card>
    )
  }

  return (
    <Stack p="md" gap="xl">
      <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
        Personas
      </Text>

      <Stack gap="sm">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Activas ({active.length})
        </Text>
        {active.length === 0 && (
          <Card><Text size="sm" c="dimmed" ta="center" py="md">Sin personas activas.</Text></Card>
        )}
        {active.map((row) => <PersonCard key={row.id} row={row} />)}
      </Stack>

      {inactive.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            Inactivas ({inactive.length})
          </Text>
          {inactive.map((row) => <PersonCard key={row.id} row={row} />)}
        </Stack>
      )}
    </Stack>
  )
}
