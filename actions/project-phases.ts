'use server'

import { eq, and, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { projectPhases } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'

export async function getProjectPhases(projectId: string) {
  const person = await requireRole('manager')
  return db
    .select()
    .from(projectPhases)
    .where(
      and(
        eq(projectPhases.projectId, projectId),
        eq(projectPhases.organizationId, person.organizationId),
      ),
    )
    .orderBy(asc(projectPhases.sortOrder), asc(projectPhases.createdAt))
}

export async function createProjectPhase(
  projectId: string,
  data: {
    name: string
    estimatedHours?: number | null
    billingAmount?: number | null
    deliveryDate?: string | null
  },
) {
  const person = await requireRole('admin')

  const existing = await getProjectPhases(projectId)
  const sortOrder = existing.length

  const [phase] = await db
    .insert(projectPhases)
    .values({
      organizationId: person.organizationId,
      projectId,
      name: data.name.trim(),
      estimatedHours: data.estimatedHours?.toString() ?? null,
      billingAmount: data.billingAmount?.toString() ?? null,
      deliveryDate: data.deliveryDate ?? null,
      sortOrder,
    })
    .returning()

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'project_phase',
    entityId: phase!.id,
    action: 'created',
    diff: { before: null, after: { projectId, name: data.name } },
  })

  revalidatePath(`/projects/${projectId}`)
  return { ok: true, id: phase!.id }
}

export async function updateProjectPhaseStatus(
  phaseId: string,
  status: 'planned' | 'in_progress' | 'delivered' | 'invoiced',
) {
  const person = await requireRole('admin')

  const [phase] = await db
    .select()
    .from(projectPhases)
    .where(and(eq(projectPhases.id, phaseId), eq(projectPhases.organizationId, person.organizationId)))
    .limit(1)

  if (!phase) return { ok: false, error: 'Fase no encontrada' }

  await db
    .update(projectPhases)
    .set({ status, updatedAt: new Date() })
    .where(eq(projectPhases.id, phaseId))

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'project_phase',
    entityId: phaseId,
    action: 'updated',
    diff: { before: { status: phase.status }, after: { status } },
  })

  revalidatePath(`/projects/${phase.projectId}`)
  return { ok: true }
}

export async function deleteProjectPhase(phaseId: string) {
  const person = await requireRole('admin')

  const [phase] = await db
    .select()
    .from(projectPhases)
    .where(and(eq(projectPhases.id, phaseId), eq(projectPhases.organizationId, person.organizationId)))
    .limit(1)

  if (!phase) return { ok: false, error: 'Fase no encontrada' }

  await db.delete(projectPhases).where(eq(projectPhases.id, phaseId))

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'project_phase',
    entityId: phaseId,
    action: 'deleted',
    diff: { before: { projectId: phase.projectId, name: phase.name }, after: null },
  })

  revalidatePath(`/projects/${phase.projectId}`)
  return { ok: true }
}
