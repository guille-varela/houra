'use server'

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { persons, timeEntries } from '@/db/schema'
import { getCurrentPerson } from '@/lib/auth-helpers'
import type { Area, Role } from '@/lib/matrix'

type CellEntriesResult =
  | { ok: true; entries: Array<{ personName: string; date: string; hours: number; description: string | null }> }
  | { ok: false; error: string }

export async function getCellEntries(params: {
  projectId: string
  area: Area
  role: Role
}): Promise<CellEntriesResult> {
  const person = await getCurrentPerson()
  if (!person) return { ok: false, error: 'Sesión expirada.' }

  const rows = await db
    .select({
      personName: persons.name,
      date: timeEntries.date,
      hours: timeEntries.hours,
      description: timeEntries.description,
    })
    .from(timeEntries)
    .innerJoin(persons, eq(persons.id, timeEntries.personId))
    .where(
      and(
        eq(timeEntries.projectId, params.projectId),
        eq(timeEntries.area, params.area),
        eq(persons.professionalCategory, params.role),
      ),
    )
    .orderBy(timeEntries.date)

  return {
    ok: true,
    entries: rows.map((r) => ({
      personName: r.personName,
      date: r.date,
      hours: parseFloat(r.hours),
      description: r.description,
    })),
  }
}
