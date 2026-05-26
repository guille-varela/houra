'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { hourTransfers, projects } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'

const createHourTransferSchema = z.object({
  fromProjectId: z.string().uuid(),
  toProjectId: z.string().uuid(),
  area: z.string().min(1),
  role: z.string().min(1),
  hours: z.number().positive().max(99999),
  reason: z.string().min(1).max(500),
})

export async function createHourTransfer(input: unknown) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const parsed = createHourTransferSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Datos inválidos' }

  const { fromProjectId, toProjectId, area, role, hours, reason } = parsed.data

  if (fromProjectId === toProjectId) {
    return { ok: false as const, error: 'El proyecto origen y destino deben ser distintos' }
  }

  const [fromProject] = await db
    .select({ workspaceId: projects.workspaceId, organizationId: projects.organizationId })
    .from(projects).where(eq(projects.id, fromProjectId)).limit(1)

  const [toProject] = await db
    .select({ workspaceId: projects.workspaceId, organizationId: projects.organizationId })
    .from(projects).where(eq(projects.id, toProjectId)).limit(1)

  if (!fromProject || !toProject) return { ok: false as const, error: 'Proyecto no encontrado' }
  if (fromProject.organizationId !== person.organizationId) return { ok: false as const, error: 'Sin permisos' }
  if (fromProject.workspaceId !== toProject.workspaceId) {
    return { ok: false as const, error: 'Los proyectos deben pertenecer al mismo workspace' }
  }

  const [transfer] = await db.insert(hourTransfers).values({
    organizationId: person.organizationId,
    fromProjectId,
    toProjectId,
    area,
    role,
    hours: hours.toString(),
    reason,
    performedBy: person.id,
    performedAt: new Date(),
  }).returning({ id: hourTransfers.id })

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    action: 'hour_transfer.create',
    entityType: 'hour_transfer',
    entityId: transfer!.id,
    diff: { before: null, after: { fromProjectId, toProjectId, area, role, hours, reason } },
  })

  revalidatePath(`/workspaces/${fromProject.workspaceId}`)
  return { ok: true as const }
}
