import { NextRequest, NextResponse } from 'next/server'
import { ilike, or, isNull, and, eq } from 'drizzle-orm'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { projects, persons } from '@/db/schema'

export async function GET(req: NextRequest) {
  const person = await getCurrentPerson()
  if (!person) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q || q.length < 2) return NextResponse.json({ projects: [], people: [] })

  const pattern = `%${q}%`
  const orgId = person.organizationId

  const [projectRows, personRows] = await Promise.all([
    db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(and(
        eq(projects.organizationId, orgId),
        ilike(projects.name, pattern),
      ))
      .limit(6),

    person.appRole === 'contributor'
      ? Promise.resolve([])
      : db
          .select({ id: persons.id, name: persons.name, email: persons.email })
          .from(persons)
          .where(and(
            eq(persons.organizationId, orgId),
            isNull(persons.deactivatedAt),
            or(ilike(persons.name, pattern), ilike(persons.email, pattern)),
          ))
          .limit(5),
  ])

  return NextResponse.json({ projects: projectRows, people: personRows })
}
