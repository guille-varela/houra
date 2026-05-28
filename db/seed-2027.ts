/**
 * One-time script: insert 2027 holiday presets for ES, ES-MD, ES-CL.
 * Run: pnpm db:seed-2027
 *
 * Easter 2027 = 28 March  →  Jueves Santo 25 Mar, Viernes Santo 26 Mar.
 * May 2, 2027 falls on Sunday → Madrid observes the holiday on Monday May 3.
 */
import { db } from '../lib/db'
import { holidayPresets } from './schema'

type HolidayDay = { date: string; name: string }

const NATIONAL_2027: HolidayDay[] = [
  { date: '2027-01-01', name: 'Año Nuevo' },
  { date: '2027-01-06', name: 'Epifanía del Señor' },
  { date: '2027-03-26', name: 'Viernes Santo' },
  { date: '2027-05-01', name: 'Fiesta del Trabajo' },
  { date: '2027-08-15', name: 'Asunción de la Virgen' },
  { date: '2027-10-12', name: 'Fiesta Nacional de España' },
  { date: '2027-11-01', name: 'Todos los Santos' },
  { date: '2027-12-06', name: 'Día de la Constitución Española' },
  { date: '2027-12-08', name: 'La Inmaculada Concepción' },
  { date: '2027-12-25', name: 'Natividad del Señor' },
]

const REGIONS_2027: Record<string, HolidayDay[]> = {
  ES: NATIONAL_2027,
  'ES-MD': [
    ...NATIONAL_2027,
    { date: '2027-01-30', name: 'San Publicito (Convenio Publicidad)' },
    { date: '2027-03-25', name: 'Jueves Santo' },
    { date: '2027-05-03', name: 'Fiesta de la Comunidad de Madrid (traslado lunes)' },
    { date: '2027-11-09', name: 'Nuestra Señora de la Almudena' },
    { date: '2027-12-31', name: 'Nochevieja (Convenio Publicidad)' },
  ],
  'ES-CL': [
    ...NATIONAL_2027,
    { date: '2027-03-25', name: 'Jueves Santo' },
    { date: '2027-04-23', name: 'Día de Castilla y León' },
  ],
}

async function seed2027() {
  console.log('🗓  Inserting 2027 holiday presets...\n')
  for (const [region, dates] of Object.entries(REGIONS_2027)) {
    await db
      .insert(holidayPresets)
      .values({ region, year: 2027, dates })
      .onConflictDoNothing()
    console.log(`  ✅ ${region} — ${dates.length} festivos`)
  }
  console.log('\n✔  Done.')
}

seed2027().catch(console.error).finally(() => process.exit())
