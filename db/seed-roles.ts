/**
 * Actualiza professionalCategory + primaryArea del equipo.
 * Ejecutar: pnpm db:seed-roles
 */
import 'dotenv/config'
import { db } from '../lib/db'
import { persons } from '../db/schema'
import { eq } from 'drizzle-orm'

type Category = 'head' | 'lead' | 'senior' | 'mid' | 'junior' | 'trainee'
type Area     = 'ux' | 'ui' | 'research' | 'cro'

const ROLES: Array<{ email: string; category: Category; area: Area }> = [
  // Head
  { email: 'francisco.gf@houra.com',       category: 'head',   area: 'ux' },
  // Leads UX
  { email: 'ion.gomez@houra.com',           category: 'lead',   area: 'ux' },
  { email: 'carla.lopez@houra.com',         category: 'lead',   area: 'ux' },
  // Leads UI
  { email: 'daniel.pena@houra.com',         category: 'lead',   area: 'ui' },
  { email: 'guillermo.varela@houra.com',    category: 'lead',   area: 'ui' },
  // Seniors Product
  { email: 'alberto.prieto@houra.com',      category: 'senior', area: 'ui' },
  { email: 'naiara.pascual@houra.com',      category: 'senior', area: 'ui' },
  { email: 'daniel.sp@houra.com',           category: 'senior', area: 'ux' },
  { email: 'fernando.llorente@houra.com',   category: 'senior', area: 'ui' },
  { email: 'begona.bagur@houra.com',        category: 'senior', area: 'research' },
  // Middles Product
  { email: 'antonio.diaz@houra.com',        category: 'mid',    area: 'ux' }, // Toni — excedencia
  { email: 'daniel.criado@houra.com',       category: 'mid',    area: 'ui' }, // Zilch
  { email: 'jordi.niubo@houra.com',         category: 'mid',    area: 'ui' },
  { email: 'alvaro.medrano@houra.com',      category: 'mid',    area: 'ui' },
  { email: 'andrea.blanco@houra.com',       category: 'mid',    area: 'ux' },
  { email: 'irene.galan@houra.com',         category: 'mid',    area: 'ux' },
  { email: 'marina.pereira@houra.com',      category: 'mid',    area: 'ui' },
  { email: 'lucia.paredes@houra.com',       category: 'mid',    area: 'ux' },
  { email: 'bernardo.sanchez@houra.com',    category: 'mid',    area: 'ui' },
  // Juniors Product
  { email: 'alvaro.dv@houra.com',           category: 'junior', area: 'ui' },
  // CRO (otro departamento)
  { email: 'josefa.inostroza@houra.com',    category: 'senior', area: 'cro' },
  { email: 'carlos.oa@houra.com',           category: 'senior', area: 'cro' },
  { email: 'emilio.cuchillo@houra.com',     category: 'senior', area: 'cro' },
]

async function main() {
  for (const r of ROLES) {
    await db.update(persons)
      .set({ professionalCategory: r.category, primaryArea: r.area })
      .where(eq(persons.email, r.email))
    console.log(`  ✅ ${r.email} → ${r.category} / ${r.area}`)
  }
  console.log('\nRoles actualizados.')
}

main().catch((e) => { console.error(e); process.exit(1) })
