/**
 * Seed puntual: añade a Fernando Llorente como persona en Houra DB.
 * Región ES-CL (Castilla y León / Valladolid).
 * Ejecutar: pnpm db:seed-fernando
 */
import 'dotenv/config'
import { hashPassword } from 'better-auth/crypto'
import { nanoid } from 'nanoid'
import { db } from '../lib/db'
import { organizations, persons, user, account } from '../db/schema'
import { eq } from 'drizzle-orm'

function generateId() { return nanoid() }

async function main() {
  const [org] = await db.select().from(organizations).limit(1)
  if (!org) throw new Error('No hay organización en la DB. Ejecuta pnpm db:seed primero.')

  const existing = await db.select().from(persons).where(eq(persons.email, 'fernando.llorente@gut.com'))
  if (existing.length > 0) {
    console.log('⚠️  Fernando Llorente ya existe en la DB.')
    process.exit(0)
  }

  const hashed  = await hashPassword('Fernando1234!')
  const userId  = generateId()
  const now     = new Date()

  await db.insert(user).values({
    id: userId, name: 'Fernando Llorente', email: 'fernando.llorente@gut.com',
    emailVerified: true, createdAt: now, updatedAt: now,
  })

  await db.insert(account).values({
    id: generateId(), accountId: 'fernando.llorente@gut.com',
    providerId: 'credential', userId, password: hashed, createdAt: now, updatedAt: now,
  })

  await db.insert(persons).values({
    userId,
    organizationId:       org.id,
    name:                 'Fernando Llorente',
    email:                'fernando.llorente@gut.com',
    appRole:              'contributor',
    professionalCategory: 'senior',
    primaryArea:          'ui',
    holidayRegion:        'ES-CL',
  })

  console.log('✅ Fernando Llorente creado (ES-CL / Valladolid)')
  console.log('   Email: fernando.llorente@gut.com  /  Password: Fernando1234!')
}

main().catch((e) => { console.error(e); process.exit(1) })
