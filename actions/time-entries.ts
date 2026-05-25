'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { timeEntries } from '@/db/schema'
import { getCurrentPerson, getOrganizationContext } from '@/lib/auth-helpers'
import {
  assertAreaAllowed,
  assertPersonActive,
  assertPersonAssigned,
  assertProjectAcceptsEntries,
} from '@/lib/guards'
import { resolveRate } from '@/lib/rates'
import { logAuditEvent } from '@/lib/audit'
import { createTimeEntrySchema } from '@/lib/schemas/time-entry'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function createTimeEntry(raw: unknown): Promise<ActionResult> {
  const parsed = createTimeEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const { projectId, date, hours, area, description } = parsed.data

  const [person, org] = await Promise.all([getCurrentPerson(), getOrganizationContext()])
  if (!person) return { ok: false, error: 'Sesión expirada. Vuelve a iniciar sesión.' }
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  const guards = await Promise.all([
    assertPersonActive(person.id),
    assertPersonAssigned(person.id, projectId),
    assertProjectAcceptsEntries(projectId),
    assertAreaAllowed(person.id, projectId, area),
  ])
  for (const g of guards) {
    if (!g.ok) return g
  }

  let resolvedRates: { costRateCents: number; soldRateCents: number }
  try {
    resolvedRates = await resolveRate(
      person.id,
      projectId,
      area,
      person.professionalCategory,
      date,
    )
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se encontró tarifa para este rol/área.',
    }
  }

  const [entry] = await db
    .insert(timeEntries)
    .values({
      organizationId: org.id,
      personId: person.id,
      projectId,
      date,
      hours: String(hours),
      area,
      description: description ?? null,
      costRateAtEntryCents: resolvedRates.costRateCents,
      soldRateAtEntryCents: resolvedRates.soldRateCents,
    })
    .returning()

  if (!entry) return { ok: false, error: 'Error al guardar la entrada.' }

  await logAuditEvent({
    organizationId: org.id,
    actorId: person.id,
    action: 'time_entry.create',
    entityType: 'time_entry',
    entityId: entry.id,
    diff: { before: null, after: { projectId, date, hours, area } },
  })

  revalidatePath('/today')
  revalidatePath('/week')
  return { ok: true }
}

export async function deleteTimeEntry(entryId: string): Promise<ActionResult> {
  const [person, org] = await Promise.all([getCurrentPerson(), getOrganizationContext()])
  if (!person) return { ok: false, error: 'Sesión expirada.' }
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  const [entry] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, entryId), eq(timeEntries.personId, person.id)))
    .limit(1)

  if (!entry) return { ok: false, error: 'Entrada no encontrada.' }

  await db.delete(timeEntries).where(eq(timeEntries.id, entryId))

  await logAuditEvent({
    organizationId: org.id,
    actorId: person.id,
    action: 'time_entry.delete',
    entityType: 'time_entry',
    entityId: entryId,
    diff: { before: { id: entryId }, after: null },
  })

  revalidatePath('/today')
  revalidatePath('/week')
  return { ok: true }
}
