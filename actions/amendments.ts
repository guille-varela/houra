'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { amendments, projects } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { notifySlack } from '@/lib/notify'
import { createAmendmentSchema } from '@/lib/schemas/amendment'

export async function createAmendment(raw: unknown) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const parsed = createAmendmentSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { projectId, deltaAllocation, reason, clientReference, effectiveDate } = parsed.data

  const [project] = await db
    .select({ status: projects.status, organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) return { ok: false as const, error: 'Proyecto no encontrado' }
  if (!['active', 'paused'].includes(project.status)) {
    return { ok: false as const, error: 'Los amendments solo aplican a proyectos activos o pausados' }
  }

  const [amendment] = await db
    .insert(amendments)
    .values({
      organizationId: project.organizationId,
      projectId,
      deltaAllocation,
      reason,
      clientReference: clientReference ?? null,
      effectiveDate,
      createdBy: person.id,
    })
    .returning()

  await logAuditEvent({
    organizationId: project.organizationId,
    actorId: person.id,
    action: 'amendment.create',
    entityType: 'amendment',
    entityId: amendment!.id,
    diff: { before: null, after: { projectId, deltaAllocation, reason, effectiveDate } },
  })

  await notifySlack(
    `📋 Amendment creado en proyecto por ${person.name}: "${reason}"`,
  )

  revalidatePath(`/projects/${projectId}`)
  return { ok: true as const, amendmentId: amendment!.id }
}
