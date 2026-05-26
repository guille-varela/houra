'use server'

import { count, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { persons } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'

export async function deactivatePerson(personId: string) {
  let actor
  try {
    actor = await requireRole('admin')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const [target] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1)
  if (!target) return { ok: false as const, error: 'Persona no encontrada' }
  if (target.organizationId !== actor.organizationId) return { ok: false as const, error: 'Sin permisos' }
  if (target.deactivatedAt) return { ok: false as const, error: 'La persona ya está desactivada' }

  const now = new Date()
  await db.update(persons).set({ deactivatedAt: now, updatedAt: now }).where(eq(persons.id, personId))

  await logAuditEvent({
    organizationId: actor.organizationId,
    actorId: actor.id,
    action: 'person.deactivate',
    entityType: 'person',
    entityId: personId,
    diff: { before: { deactivatedAt: null }, after: { deactivatedAt: now.toISOString() } },
  })

  revalidatePath(`/people/${personId}`)
  revalidatePath('/people')
  return { ok: true as const }
}

export async function anonymizePerson(personId: string) {
  let actor
  try {
    actor = await requireRole('admin')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const [target] = await db.select().from(persons).where(eq(persons.id, personId)).limit(1)
  if (!target) return { ok: false as const, error: 'Persona no encontrada' }
  if (target.organizationId !== actor.organizationId) return { ok: false as const, error: 'Sin permisos' }
  if (target.anonymizedAt) return { ok: false as const, error: 'La persona ya está anonimizada' }

  const countRows = await db
    .select({ value: count() })
    .from(persons)
    .where(eq(persons.organizationId, actor.organizationId))

  const label = `Ex-colaborador #${(countRows[0]?.value ?? 0) + 1}`
  const now = new Date()

  await db.update(persons).set({
    name: label,
    email: `anonymized-${personId.slice(0, 8)}@removed.local`,
    holidayRegion: null,
    anonymizedAt: now,
    deactivatedAt: target.deactivatedAt ?? now,
    updatedAt: now,
  }).where(eq(persons.id, personId))

  await logAuditEvent({
    organizationId: actor.organizationId,
    actorId: actor.id,
    action: 'person.anonymize',
    entityType: 'person',
    entityId: personId,
    diff: {
      before: { name: target.name, email: target.email },
      after: { name: label, email: '[anonimizado]' },
    },
  })

  revalidatePath(`/people/${personId}`)
  revalidatePath('/people')
  return { ok: true as const }
}
