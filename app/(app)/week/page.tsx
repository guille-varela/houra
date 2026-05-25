import { and, eq, gte, lte } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Stack, Title, Text, Group, Badge, Card } from '@mantine/core'
import { db } from '@/lib/db'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { projectAssignments, projects, timeEntries } from '@/db/schema'
import { formatDateEs, getLocalDateString, getWeekRange } from '@/lib/dates'

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

export default async function WeekPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  const { start, end } = getWeekRange()

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(eq(projectAssignments.personId, person.id))

  const projectNames: Record<string, string> = {}
  for (const p of projectRows) {
    projectNames[p.id] = p.name
  }

  const weekEntries = await db
    .select({
      id: timeEntries.id,
      projectId: timeEntries.projectId,
      date: timeEntries.date,
      hours: timeEntries.hours,
      area: timeEntries.area,
      description: timeEntries.description,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.personId, person.id),
        gte(timeEntries.date, start),
        lte(timeEntries.date, end),
      ),
    )

  // Group by date
  const byDate = new Map<string, typeof weekEntries>()
  for (const entry of weekEntries) {
    const bucket = byDate.get(entry.date) ?? []
    bucket.push(entry)
    byDate.set(entry.date, bucket)
  }

  // Build Mon-Sun ordered days
  const days: string[] = []
  const startDate = new Date(start + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push(getLocalDateString(d))
  }

  const weekTotal = weekEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0)

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between" align="flex-start">
        <Title order={3}>Esta semana</Title>
        <Badge size="lg" color="gray" variant="light">
          {weekTotal.toFixed(1)}h
        </Badge>
      </Group>

      {days.map((day) => {
        const dayEntries = byDate.get(day) ?? []
        const dayTotal = dayEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0)
        const isToday = day === getLocalDateString()

        return (
          <div key={day}>
            <Group justify="space-between" mb="xs">
              <Text
                size="sm"
                fw={isToday ? 700 : 400}
                >
                {formatDateEs(day)}
              </Text>
              {dayEntries.length > 0 && (
                <Text size="xs" c="dimmed">
                  {dayTotal.toFixed(1)}h
                </Text>
              )}
            </Group>

            {dayEntries.length === 0 ? (
              <Text size="xs" c="dimmed" ml="xs">
                Sin entradas
              </Text>
            ) : (
              <Stack gap={4}>
                {dayEntries.map((entry) => (
                  <Card key={entry.id} withBorder p="xs" radius="sm">
                    <Group justify="space-between">
                      <Text size="sm">{projectNames[entry.projectId] ?? '—'}</Text>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">
                          {AREA_LABELS[entry.area] ?? entry.area}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {parseFloat(entry.hours).toFixed(1)}h
                        </Text>
                      </Group>
                    </Group>
                    {entry.description && (
                      <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
                        {entry.description}
                      </Text>
                    )}
                  </Card>
                ))}
              </Stack>
            )}
          </div>
        )
      })}
    </Stack>
  )
}
