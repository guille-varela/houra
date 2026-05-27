'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { timeOffEntries } from '@/db/schema'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { createTimeOffEntrySchema, deleteTimeOffEntrySchema } from '@/lib/schemas/time-off'

function eachDayInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00Z')
  const last = new Date(end + 'T12:00:00Z')
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

export async function createTimeOffEntry(raw: unknown) {
  const person = await getCurrentPerson()
  if (!person) return { ok: false as const, error: 'No autenticado' }

  const parsed = createTimeOffEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { startDate, endDate, type, hoursPerDay, note } = parsed.data

  if (endDate < startDate) {
    return { ok: false as const, error: 'La fecha de fin no puede ser anterior a la de inicio' }
  }

  const dates = eachDayInRange(startDate, endDate)

  await db.insert(timeOffEntries).values(
    dates.map((date) => ({
      organizationId: person.organizationId,
      personId: person.id,
      date,
      type,
      hours: hoursPerDay.toString(),
      note: note ?? null,
    })),
  )

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    action: 'time_off.create',
    entityType: 'timeOffEntry',
    entityId: person.id,
    diff: { before: null, after: { startDate, endDate, type, hoursPerDay, days: dates.length } },
  })

  revalidatePath('/time-off')
  return { ok: true as const, created: dates.length }
}

export async function deleteTimeOffEntry(raw: unknown) {
  const person = await getCurrentPerson()
  if (!person) return { ok: false as const, error: 'No autenticado' }

  const parsed = deleteTimeOffEntrySchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'ID inválido' }

  await db
    .delete(timeOffEntries)
    .where(
      and(eq(timeOffEntries.id, parsed.data.id), eq(timeOffEntries.personId, person.id)),
    )

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    action: 'time_off.delete',
    entityType: 'timeOffEntry',
    entityId: parsed.data.id,
    diff: { before: { id: parsed.data.id }, after: null },
  })

  revalidatePath('/time-off')
  return { ok: true as const }
}
