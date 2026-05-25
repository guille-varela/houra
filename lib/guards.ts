import { and, eq, isNull } from 'drizzle-orm'
import { db } from './db'
import { persons, projectAssignments, projects } from '@/db/schema'

type GuardOk = { ok: true }
type GuardErr = { ok: false; error: string }
type GuardResult = GuardOk | GuardErr

export async function assertPersonAssigned(
  personId: string,
  projectId: string,
): Promise<GuardResult> {
  const [assignment] = await db
    .select({ id: projectAssignments.id })
    .from(projectAssignments)
    .where(
      and(
        eq(projectAssignments.personId, personId),
        eq(projectAssignments.projectId, projectId),
        eq(projectAssignments.isActive, true),
      ),
    )
    .limit(1)

  if (!assignment) {
    return { ok: false, error: 'Person is not assigned to this project' }
  }
  return { ok: true }
}

export async function assertProjectAcceptsEntries(projectId: string): Promise<GuardResult> {
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) {
    return { ok: false, error: 'Project not found' }
  }
  if (project.status === 'closed') {
    return { ok: false, error: 'Project is closed and does not accept new entries' }
  }
  return { ok: true }
}

export async function assertPersonActive(personId: string): Promise<GuardResult> {
  const [person] = await db
    .select({ deactivatedAt: persons.deactivatedAt })
    .from(persons)
    .where(eq(persons.id, personId))
    .limit(1)

  if (!person) {
    return { ok: false, error: 'Person not found' }
  }
  if (person.deactivatedAt !== null && person.deactivatedAt !== undefined) {
    return { ok: false, error: 'Person has been deactivated' }
  }
  return { ok: true }
}

export async function assertAreaAllowed(
  personId: string,
  projectId: string,
  area: string,
): Promise<GuardResult> {
  const [assignment] = await db
    .select({ allowedAreas: projectAssignments.allowedAreas })
    .from(projectAssignments)
    .where(
      and(
        eq(projectAssignments.personId, personId),
        eq(projectAssignments.projectId, projectId),
        eq(projectAssignments.isActive, true),
      ),
    )
    .limit(1)

  if (!assignment) {
    return { ok: false, error: 'No active assignment found' }
  }

  const allowedAreas = assignment.allowedAreas as string[]
  if (!allowedAreas.includes(area)) {
    return { ok: false, error: `Area '${area}' is not allowed for this assignment` }
  }
  return { ok: true }
}
