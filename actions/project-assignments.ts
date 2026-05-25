'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectAssignments, persons } from '@/db/schema'
import { getOrganizationContext, requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { upsertAssignmentSchema, deactivateAssignmentSchema } from '@/lib/schemas/project'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function upsertAssignment(raw: unknown): Promise<ActionResult> {
  const parsed = upsertAssignmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { projectId, personId, allowedAreas } = parsed.data

  let actor: Awaited<ReturnType<typeof requireRole>>
  try {
    actor = await requireRole('admin')
  } catch {
    return { ok: false, error: 'Sin permisos.' }
  }

  const org = await getOrganizationContext()
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  const [person] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.organizationId, org.id)))
    .limit(1)

  if (!person) return { ok: false, error: 'Persona no encontrada.' }

  const [existing] = await db
    .select({ id: projectAssignments.id, isActive: projectAssignments.isActive })
    .from(projectAssignments)
    .where(
      and(
        eq(projectAssignments.projectId, projectId),
        eq(projectAssignments.personId, personId),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(projectAssignments)
      .set({ allowedAreas, isActive: true, updatedAt: new Date() })
      .where(eq(projectAssignments.id, existing.id))

    await logAuditEvent({
      organizationId: org.id,
      actorId: actor.id,
      action: 'assignment.update',
      entityType: 'project_assignment',
      entityId: existing.id,
      diff: { before: { isActive: existing.isActive }, after: { isActive: true, allowedAreas } },
    })
  } else {
    const [created] = await db
      .insert(projectAssignments)
      .values({ organizationId: org.id, projectId, personId, allowedAreas })
      .returning()

    if (!created) return { ok: false, error: 'Error al crear la asignación.' }

    await logAuditEvent({
      organizationId: org.id,
      actorId: actor.id,
      action: 'assignment.create',
      entityType: 'project_assignment',
      entityId: created.id,
      diff: { before: null, after: { projectId, personId, allowedAreas } },
    })
  }

  revalidatePath(`/projects/${projectId}`)
  return { ok: true }
}

export async function deactivateAssignment(raw: unknown): Promise<ActionResult> {
  const parsed = deactivateAssignmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { assignmentId } = parsed.data

  let actor: Awaited<ReturnType<typeof requireRole>>
  try {
    actor = await requireRole('admin')
  } catch {
    return { ok: false, error: 'Sin permisos.' }
  }

  const org = await getOrganizationContext()
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  const [assignment] = await db
    .select({ id: projectAssignments.id, projectId: projectAssignments.projectId })
    .from(projectAssignments)
    .where(eq(projectAssignments.id, assignmentId))
    .limit(1)

  if (!assignment) return { ok: false, error: 'Asignación no encontrada.' }

  await db
    .update(projectAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(projectAssignments.id, assignmentId))

  await logAuditEvent({
    organizationId: org.id,
    actorId: actor.id,
    action: 'assignment.deactivate',
    entityType: 'project_assignment',
    entityId: assignmentId,
    diff: { before: { isActive: true }, after: { isActive: false } },
  })

  revalidatePath(`/projects/${assignment.projectId}`)
  return { ok: true }
}
