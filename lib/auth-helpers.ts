'use server'

import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from './auth'
import { db } from './db'
import { organizations, persons } from '@/db/schema'

export async function getCurrentPerson() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const [person] = await db
    .select()
    .from(persons)
    .where(eq(persons.userId, session.user.id))
    .limit(1)

  return person ?? null
}

export async function getOrganizationContext() {
  // v1: single-org — always returns the one row
  const [org] = await db.select().from(organizations).limit(1)
  return org ?? null
}

export type AppRole = 'admin' | 'manager' | 'contributor'

const roleHierarchy: Record<AppRole, number> = {
  admin: 3,
  manager: 2,
  contributor: 1,
}

export async function requireRole(minimumRole: AppRole) {
  const person = await getCurrentPerson()
  if (!person) {
    throw new Error('Unauthenticated')
  }
  if (roleHierarchy[person.appRole] < roleHierarchy[minimumRole]) {
    throw new Error('Forbidden')
  }
  return person
}
