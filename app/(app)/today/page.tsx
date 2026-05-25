import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { projectAssignments, projects, timeEntries } from '@/db/schema'
import { formatDateEs, getLocalDateString } from '@/lib/dates'
import TodayClient from './today-client'

export default async function TodayPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  const dateStr = getLocalDateString()

  const assignedRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      allowedAreas: projectAssignments.allowedAreas,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(
      and(
        eq(projectAssignments.personId, person.id),
        eq(projectAssignments.isActive, true),
        eq(projects.status, 'active'),
      ),
    )

  const rawEntries = await db
    .select({
      id: timeEntries.id,
      projectId: timeEntries.projectId,
      date: timeEntries.date,
      hours: timeEntries.hours,
      area: timeEntries.area,
      description: timeEntries.description,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.personId, person.id), eq(timeEntries.date, dateStr)))

  const totalHours = rawEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0)

  const assignedProjects = assignedRows.map((p) => ({
    id: p.id,
    name: p.name,
    allowedAreas: p.allowedAreas as string[],
  }))

  const projectNames: Record<string, string> = {}
  for (const p of assignedRows) {
    projectNames[p.id] = p.name
  }

  return (
    <TodayClient
      personName={person.name}
      date={dateStr}
      dateLabel={formatDateEs(dateStr)}
      entries={rawEntries}
      totalHours={totalHours}
      assignedProjects={assignedProjects}
      projectNames={projectNames}
    />
  )
}
