'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rates } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { upsertRateSchema, deleteRateSchema } from '@/lib/schemas/rate'

export async function upsertRate(raw: unknown) {
  let person
  try {
    person = await requireRole('admin')
  } catch {
    return { ok: false as const, error: 'Solo admins pueden gestionar tarifas' }
  }

  const parsed = upsertRateSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { id, area, role, costRateCents, soldRateCents, effectiveFrom, effectiveTo } = parsed.data

  if (id) {
    const [before] = await db.select().from(rates).where(eq(rates.id, id)).limit(1)
    await db
      .update(rates)
      .set({
        area,
        role,
        costRateCents,
        soldRateCents,
        effectiveFrom,
        effectiveTo: effectiveTo ?? null,
        updatedAt: new Date(),
      })
      .where(eq(rates.id, id))
    await logAuditEvent({
      organizationId: person.organizationId,
      actorId: person.id,
      action: 'rate.update',
      entityType: 'rate',
      entityId: id,
      diff: { before, after: { area, role, costRateCents, soldRateCents } },
    })
  } else {
    const [inserted] = await db
      .insert(rates)
      .values({
        organizationId: person.organizationId,
        area,
        role,
        costRateCents,
        soldRateCents,
        effectiveFrom,
        effectiveTo: effectiveTo ?? null,
      })
      .returning()
    await logAuditEvent({
      organizationId: person.organizationId,
      actorId: person.id,
      action: 'rate.create',
      entityType: 'rate',
      entityId: inserted!.id,
      diff: { before: null, after: { area, role, costRateCents, soldRateCents } },
    })
  }

  revalidatePath('/settings/rates')
  return { ok: true as const }
}

export async function deleteRate(raw: unknown) {
  let person
  try {
    person = await requireRole('admin')
  } catch {
    return { ok: false as const, error: 'Solo admins pueden gestionar tarifas' }
  }

  const parsed = deleteRateSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'ID inválido' }

  const [before] = await db.select().from(rates).where(eq(rates.id, parsed.data.id)).limit(1)
  if (!before) return { ok: false as const, error: 'Tarifa no encontrada' }

  await db.delete(rates).where(eq(rates.id, parsed.data.id))
  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    action: 'rate.delete',
    entityType: 'rate',
    entityId: parsed.data.id,
    diff: { before, after: null },
  })

  revalidatePath('/settings/rates')
  return { ok: true as const }
}
