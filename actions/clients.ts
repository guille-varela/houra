'use server'

import { eq, and, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { clients } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'

export async function getClients() {
  const person = await requireRole('manager')
  return db
    .select()
    .from(clients)
    .where(eq(clients.organizationId, person.organizationId))
    .orderBy(asc(clients.name))
}

export async function getClient(id: string) {
  const person = await requireRole('manager')
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, person.organizationId)))
    .limit(1)
  return client ?? null
}

export async function createClient(data: { name: string }) {
  const person = await requireRole('admin')

  const [client] = await db
    .insert(clients)
    .values({ organizationId: person.organizationId, name: data.name.trim() })
    .returning()

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'client',
    entityId: client!.id,
    action: 'created',
    diff: { before: null, after: { name: data.name } },
  })

  revalidatePath('/clients')
  return { ok: true, id: client!.id }
}

export async function updateClientName(id: string, name: string) {
  const person = await requireRole('admin')

  await db
    .update(clients)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.organizationId, person.organizationId)))

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'client',
    entityId: id,
    action: 'updated',
    diff: { before: null, after: { name } },
  })

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
}

export async function updateMarcoAgreement(
  id: string,
  data: {
    hasMarco: boolean
    marcoStartDate?: string | null
    marcoEndDate?: string | null
    marcoUsePerRoleRates: boolean
    marcoGlobalRateCents?: number | null
    marcoRateByCategory?: Record<string, number | null> | null
  },
) {
  const person = await requireRole('admin')

  await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.organizationId, person.organizationId)))

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'client',
    entityId: id,
    action: 'updated',
    diff: { before: null, after: data },
  })

  revalidatePath(`/clients/${id}`)
}
