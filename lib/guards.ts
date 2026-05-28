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
    return { ok: false, error: 'No estás asignado a este proyecto.' }
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
    return { ok: false, error: 'Proyecto no encontrado.' }
  }
  if (project.status === 'closed') {
    return { ok: false, error: 'Este proyecto está cerrado y ya no acepta nuevas entradas.' }
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
    return { ok: false, error: 'Tu cuenta no se encontró. Contacta con tu manager.' }
  }
  if (person.deactivatedAt !== null && person.deactivatedAt !== undefined) {
    return { ok: false, error: 'Tu cuenta está desactivada. Contacta con tu manager.' }
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
    return { ok: false, error: 'No tienes asignación activa en este proyecto.' }
  }

  const allowedAreas = assignment.allowedAreas as string[]
  if (!allowedAreas.includes(area)) {
    return { ok: false, error: 'El área seleccionada no está permitida en este proyecto.' }
  }
  return { ok: true }
}
