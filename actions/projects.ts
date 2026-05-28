'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects } from '@/db/schema'
import { getCurrentPerson, getOrganizationContext, requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import {
  isValidTransition,
  updateProjectStatusSchema,
  updateAllocationSchema,
} from '@/lib/schemas/project'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function duplicateProject(
  projectId: string,
): Promise<{ ok: true; newProjectId: string } | { ok: false; error: string }> {
  let actor
  try {
    actor = await requireRole('manager')
  } catch {
    return { ok: false, error: 'Sin permisos.' }
  }

  const [source] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!source) return { ok: false, error: 'Proyecto no encontrado.' }
  if (source.organizationId !== actor.organizationId) return { ok: false, error: 'Sin permisos.' }

  const [inserted] = await db
    .insert(projects)
    .values({
      organizationId: source.organizationId,
      workspaceId: source.workspaceId,
      name: `${source.name} (copia)`,
      type: source.type,
      areasEnabled: source.areasEnabled,
      originalAllocation: source.originalAllocation,
      weeklyHours: source.weeklyHours,
      status: 'draft',
      startDate: source.startDate,
      endDate: source.endDate,
      notificationSettings: source.notificationSettings,
      contributorDashboardAccess: source.contributorDashboardAccess,
      timezoneOverride: source.timezoneOverride,
      departmentId: source.departmentId,
    })
    .returning({ id: projects.id })

  if (!inserted) return { ok: false, error: 'Error al duplicar el proyecto.' }

  await logAuditEvent({
    organizationId: actor.organizationId,
    actorId: actor.id,
    action: 'project.duplicate',
    entityType: 'project',
    entityId: inserted.id,
    diff: {
      before: {},
      after: { duplicatedFrom: projectId, name: `${source.name} (copia)` },
    },
  })

  revalidatePath('/projects')
  return { ok: true, newProjectId: inserted.id }
}

export async function updateProjectStatus(raw: unknown): Promise<ActionResult> {
  const parsed = updateProjectStatusSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { projectId, status } = parsed.data

  let person: Awaited<ReturnType<typeof requireRole>>
  try {
    person = await requireRole('admin')
  } catch {
    return { ok: false, error: 'Sin permisos.' }
  }

  const org = await getOrganizationContext()
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  const [project] = await db
    .select({ id: projects.id, status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) return { ok: false, error: 'Proyecto no encontrado.' }

  if (!isValidTransition(project.status, status)) {
    return {
      ok: false,
      error: 'Este cambio de estado no está permitido desde la situación actual del proyecto.',
    }
  }

  const extra: Partial<typeof projects.$inferInsert> =
    status === 'closed' ? { closedAt: new Date() } : {}

  await db
    .update(projects)
    .set({ status, ...extra, updatedAt: new Date() })
    .where(eq(projects.id, projectId))

  await logAuditEvent({
    organizationId: org.id,
    actorId: person.id,
    action: 'project.status_change',
    entityType: 'project',
    entityId: projectId,
    diff: { before: { status: project.status }, after: { status } },
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  return { ok: true }
}

export async function updateAllocation(raw: unknown): Promise<ActionResult> {
  const parsed = updateAllocationSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { projectId, allocation } = parsed.data

  let person: Awaited<ReturnType<typeof requireRole>>
  try {
    person = await requireRole('admin')
  } catch {
    return { ok: false, error: 'Sin permisos.' }
  }

  const org = await getOrganizationContext()
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  const [project] = await db
    .select({ id: projects.id, status: projects.status, originalAllocation: projects.originalAllocation })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) return { ok: false, error: 'Proyecto no encontrado.' }
  if (project.status !== 'draft') {
    return { ok: false, error: 'Solo se puede editar la asignación en estado borrador.' }
  }

  await db
    .update(projects)
    .set({ originalAllocation: allocation, updatedAt: new Date() })
    .where(eq(projects.id, projectId))

  await logAuditEvent({
    organizationId: org.id,
    actorId: person.id,
    action: 'project.allocation_update',
    entityType: 'project',
    entityId: projectId,
    diff: { before: { allocation: project.originalAllocation }, after: { allocation } },
  })

  revalidatePath(`/projects/${projectId}`)
  return { ok: true }
}
