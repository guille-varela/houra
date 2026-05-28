/**
 * Seed del equipo completo con emails @houra.com.
 * Corrige el email de Fernando (antes @gut.com).
 * Ejecutar: pnpm db:seed-team
 */
import 'dotenv/config'
import { hashPassword } from 'better-auth/crypto'
import { nanoid } from 'nanoid'
import { db } from '../lib/db'
import { organizations, persons, user, account } from '../db/schema'
import { eq } from 'drizzle-orm'

function generateId() { return nanoid() }

// Región por defecto ES (nacionales). Especificamos las que sabemos.
const TEAM: Array<{
  email: string
  name: string
  holidayRegion: string
  professionalCategory: 'lead' | 'senior' | 'mid' | 'junior' | 'trainee' | 'head'
  primaryArea: 'ux' | 'ui' | 'research' | 'pm' | 'dev' | 'ops' | 'strategy'
}> = [
  { email: 'agostina.giannelli@houra.com', name: 'Agostina',   holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ux' },
  { email: 'alberto.prieto@houra.com',     name: 'Alberto',    holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ux' },
  { email: 'alvaro.medrano@houra.com',     name: 'A. Medrano', holidayRegion: 'ES',    professionalCategory: 'senior', primaryArea: 'ux' },
  { email: 'alvaro.dv@houra.com',          name: 'A. Del Valle', holidayRegion: 'ES',  professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'andrea.blanco@houra.com',      name: 'Andrea',     holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ux' },
  { email: 'begona.bagur@houra.com',       name: 'Bego',       holidayRegion: 'ES-IB', professionalCategory: 'senior', primaryArea: 'ux' },
  { email: 'bernardo.sanchez@houra.com',   name: 'Bernardo',   holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'carla.lopez@houra.com',        name: 'Carla',      holidayRegion: 'ES',    professionalCategory: 'senior', primaryArea: 'ux' },
  { email: 'carlos.oa@houra.com',          name: 'Carlos',     holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'daniel.sp@houra.com',          name: 'Dani S.',    holidayRegion: 'ES',    professionalCategory: 'senior', primaryArea: 'ux' },
  { email: 'daniel.criado@houra.com',      name: 'Zilch',      holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'daniel.pena@houra.com',        name: 'Dani Peña',  holidayRegion: 'ES',    professionalCategory: 'senior', primaryArea: 'ux' },
  { email: 'emilio.cuchillo@houra.com',    name: 'Emilio',     holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'fernando.llorente@houra.com',  name: 'Fernando',   holidayRegion: 'ES-CL', professionalCategory: 'senior', primaryArea: 'ui' },
  { email: 'francisco.gf@houra.com',       name: 'Fran',       holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ux' },
  { email: 'guillermo.varela@houra.com',   name: 'Guille',     holidayRegion: 'ES-MD', professionalCategory: 'lead',   primaryArea: 'ux' },
  { email: 'ion.gomez@houra.com',          name: 'Ion',        holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'irene.galan@houra.com',        name: 'Irene',      holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ux' },
  { email: 'joaquin.briceno@houra.com',    name: 'Joaquín',    holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ux' },
  { email: 'jordi.niubo@houra.com',        name: 'Jordi',      holidayRegion: 'ES-CT', professionalCategory: 'senior', primaryArea: 'ux' },
  { email: 'josefa.inostroza@houra.com',   name: 'Josefa',     holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'lucia.paredes@houra.com',      name: 'Lucía',      holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ux' },
  { email: 'marina.pereira@houra.com',     name: 'Marina',     holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
  { email: 'naiara.pascual@houra.com',     name: 'Naiara',     holidayRegion: 'ES',    professionalCategory: 'senior', primaryArea: 'ux' },
  { email: 'antonio.diaz@houra.com',       name: 'Antonio',    holidayRegion: 'ES',    professionalCategory: 'mid',    primaryArea: 'ui' },
]

async function main() {
  const [org] = await db.select().from(organizations).limit(1)
  if (!org) throw new Error('No hay organización. Ejecuta pnpm db:seed primero.')

  // Eliminar Fernando @gut.com si existe (email incorrecto del seed anterior)
  const oldFernando = await db.select().from(persons).where(eq(persons.email, 'fernando.llorente@gut.com'))
  if (oldFernando.length > 0) {
    await db.delete(persons).where(eq(persons.email, 'fernando.llorente@gut.com'))
    await db.delete(user).where(eq(user.email, 'fernando.llorente@gut.com'))
    console.log('🗑  Eliminado Fernando @gut.com (email incorrecto)')
  }

  let created = 0
  let skipped = 0

  for (const m of TEAM) {
    const existing = await db.select().from(persons).where(eq(persons.email, m.email))
    if (existing.length > 0) {
      // Actualizar nombre y password aunque ya exista
      const hashed = await hashPassword('@houra')
      await db.update(persons).set({ name: m.name }).where(eq(persons.email, m.email))
      await db.update(user).set({ name: m.name }).where(eq(user.email, m.email))
      const [acc] = await db.select().from(account).where(eq(account.accountId, m.email))
      if (acc) await db.update(account).set({ password: hashed }).where(eq(account.id, acc.id))
      console.log(`  ↻ ${m.name} (${m.email}) — actualizado`)
      skipped++
      continue
    }

    const hashed    = await hashPassword('@houra')
    const userId    = generateId()
    const now       = new Date()

    await db.insert(user).values({
      id: userId, name: m.name, email: m.email,
      emailVerified: true, createdAt: now, updatedAt: now,
    })

    await db.insert(account).values({
      id: generateId(), accountId: m.email,
      providerId: 'credential', userId, password: hashed, createdAt: now, updatedAt: now,
    })

    await db.insert(persons).values({
      userId,
      organizationId:       org.id,
      name:                 m.name,
      email:                m.email,
      appRole:              'contributor',
      professionalCategory: m.professionalCategory,
      primaryArea:          m.primaryArea,
      holidayRegion:        m.holidayRegion,
    })

    console.log(`  ✅ ${m.name} (${m.email}) — ${m.holidayRegion}`)
    created++
  }

  console.log(`\nListo: ${created} creados, ${skipped} ya existían.`)
  console.log('Contraseña: @houra')
}

main().catch((e) => { console.error(e); process.exit(1) })
