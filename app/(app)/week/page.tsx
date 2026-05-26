import { and, eq, gte, lte } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Stack, Text, Group, Card, Badge } from '@mantine/core'
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
  for (const p of projectRows) projectNames[p.id] = p.name

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

  const byDate = new Map<string, typeof weekEntries>()
  for (const entry of weekEntries) {
    const bucket = byDate.get(entry.date) ?? []
    bucket.push(entry)
    byDate.set(entry.date, bucket)
  }

  const days: string[] = []
  const startDate = new Date(start + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push(getLocalDateString(d))
  }

  const weekTotal = weekEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0)
  const today = getLocalDateString()

  return (
    <Stack p="md" gap="md">
      {/* KPI card */}
      <Card>
        <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Esta semana
        </Text>
        <Text
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          {weekTotal.toFixed(1)}h
        </Text>
      </Card>

      {/* Days */}
      <Stack gap="sm">
        {days.map((day) => {
          const dayEntries = byDate.get(day) ?? []
          const dayTotal = dayEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0)
          const isToday = day === today

          return (
            <div key={day}>
              <Group justify="space-between" mb={6} px={2}>
                <Text
                  size="xs"
                  fw={600}
                  tt="uppercase"
                  style={{
                    letterSpacing: '0.05em',
                    color: isToday
                      ? 'var(--mantine-color-dark-9)'
                      : 'var(--mantine-color-gray-5)',
                  }}
                >
                  {formatDateEs(day)}
                </Text>
                {dayEntries.length > 0 && (
                  <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {dayTotal.toFixed(1)}h
                  </Text>
                )}
              </Group>

              {dayEntries.length === 0 ? (
                <Text size="xs" c="dimmed" px={2}>—</Text>
              ) : (
                <Stack gap={6}>
                  {dayEntries.map((entry) => (
                    <Card key={entry.id} p="sm">
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                          {projectNames[entry.projectId] ?? '—'}
                        </Text>
                        <Group gap={6} style={{ flexShrink: 0 }}>
                          <Text size="xs" c="dimmed">
                            {AREA_LABELS[entry.area] ?? entry.area}
                          </Text>
                          <Text size="xs" c="dimmed">·</Text>
                          <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {parseFloat(entry.hours).toFixed(1)}h
                          </Text>
                        </Group>
                      </Group>
                      {entry.description && (
                        <Text size="xs" c="dimmed" mt={3} lineClamp={1}>
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
    </Stack>
  )
}
