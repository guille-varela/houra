import { and, eq, not } from 'drizzle-orm'
import { db } from '@/lib/db'
import { persons, projectAssignments } from '@/db/schema'
import TeamTabClient from './team-tab-client'

type Props = {
  projectId: string
  organizationId: string
}

export default async function TeamTab({ projectId, organizationId }: Props) {
  const [assignedRows, allPersons] = await Promise.all([
    db
      .select({
        assignmentId: projectAssignments.id,
        personId: persons.id,
        personName: persons.name,
        personRole: persons.professionalCategory,
        personArea: persons.primaryArea,
        allowedAreas: projectAssignments.allowedAreas,
        isActive: projectAssignments.isActive,
      })
      .from(projectAssignments)
      .innerJoin(persons, eq(persons.id, projectAssignments.personId))
      .where(eq(projectAssignments.projectId, projectId))
      .orderBy(persons.name),

    db
      .select({ id: persons.id, name: persons.name, primaryArea: persons.primaryArea })
      .from(persons)
      .where(and(eq(persons.organizationId, organizationId)))
      .orderBy(persons.name),
  ])

  return (
    <TeamTabClient
      projectId={projectId}
      assignedRows={assignedRows.map((r) => ({
        ...r,
        allowedAreas: r.allowedAreas as string[],
      }))}
      allPersons={allPersons}
    />
  )
}
