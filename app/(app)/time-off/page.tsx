import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { timeOffEntries } from '@/db/schema'
import TimeOffClient from './time-off-client'

export default async function TimeOffPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  const entries = await db
    .select({
      id: timeOffEntries.id,
      date: timeOffEntries.date,
      type: timeOffEntries.type,
      hours: timeOffEntries.hours,
      note: timeOffEntries.note,
    })
    .from(timeOffEntries)
    .where(eq(timeOffEntries.personId, person.id))
    .orderBy(desc(timeOffEntries.date))

  return <TimeOffClient entries={entries} />
}
