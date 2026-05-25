/**
 * Seed script — Phase 01
 * Run: pnpm db:seed
 *
 * Creates:
 *   - 1 Organization (Gut)
 *   - 3 Persons (admin, manager, contributor) + their auth users
 *   - Org-level rates for all area × role combos
 *   - Holiday presets 2026: ES (nacional) + 17 CC.AA.
 */
import { hashPassword } from 'better-auth/crypto'
import { nanoid } from 'nanoid'
import { db } from '../lib/db'
import {
  account,
  holidayPresets,
  organizations,
  persons,
  rates,
  user,
} from './schema'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function generateId() {
  return nanoid(24)
}

function today() {
  return new Date().toISOString().split('T')[0] as string
}

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------

const SEED_USERS = [
  {
    name: 'Guillermo Varela',
    email: 'admin@gut.com',
    password: 'Admin1234!',
    appRole: 'admin' as const,
    professionalCategory: 'lead' as const,
    primaryArea: 'ux' as const,
    holidayRegion: 'ES-MD',
  },
  {
    name: 'Manager Demo',
    email: 'manager@gut.com',
    password: 'Manager1234!',
    appRole: 'manager' as const,
    professionalCategory: 'senior' as const,
    primaryArea: 'ui' as const,
    holidayRegion: 'ES-MD',
  },
  {
    name: 'Contributor Demo',
    email: 'contributor@gut.com',
    password: 'Contrib1234!',
    appRole: 'contributor' as const,
    professionalCategory: 'mid' as const,
    primaryArea: 'ux' as const,
    holidayRegion: 'ES-CT',
  },
]

// Org-level rates (all scope FKs null = applies to whole org)
const ORG_RATES = [
  // UX
  { area: 'ux', role: 'head', costRateCents: 9000, soldRateCents: 12000 },
  { area: 'ux', role: 'lead', costRateCents: 7000, soldRateCents: 9500 },
  { area: 'ux', role: 'senior', costRateCents: 5500, soldRateCents: 7500 },
  { area: 'ux', role: 'mid', costRateCents: 4000, soldRateCents: 6000 },
  { area: 'ux', role: 'junior', costRateCents: 2800, soldRateCents: 4000 },
  { area: 'ux', role: 'trainee', costRateCents: 1500, soldRateCents: 2000 },
  // UI
  { area: 'ui', role: 'head', costRateCents: 8500, soldRateCents: 11500 },
  { area: 'ui', role: 'lead', costRateCents: 6500, soldRateCents: 9000 },
  { area: 'ui', role: 'senior', costRateCents: 5000, soldRateCents: 7000 },
  { area: 'ui', role: 'mid', costRateCents: 3800, soldRateCents: 5500 },
  { area: 'ui', role: 'junior', costRateCents: 2800, soldRateCents: 4000 },
  { area: 'ui', role: 'trainee', costRateCents: 1500, soldRateCents: 2000 },
  // Research
  { area: 'research', role: 'head', costRateCents: 8500, soldRateCents: 11500 },
  { area: 'research', role: 'lead', costRateCents: 6500, soldRateCents: 9000 },
  { area: 'research', role: 'senior', costRateCents: 5500, soldRateCents: 7500 },
  { area: 'research', role: 'mid', costRateCents: 4000, soldRateCents: 6000 },
  { area: 'research', role: 'junior', costRateCents: 2500, soldRateCents: 3800 },
  { area: 'research', role: 'trainee', costRateCents: 1500, soldRateCents: 2000 },
] as const

// ---------------------------------------------------------------------------
// 2026 holiday presets
// Easter 2026 = April 5 → Viernes Santo = April 3, Jueves Santo = April 2
// Lunes de Pascua = April 6
// Corpus Christi = June 4 (60 days after Easter)
// ---------------------------------------------------------------------------

type HolidayDay = { date: string; name: string }

const NATIONAL_2026: HolidayDay[] = [
  { date: '2026-01-01', name: 'Año Nuevo' },
  { date: '2026-01-06', name: 'Epifanía del Señor' },
  { date: '2026-04-03', name: 'Viernes Santo' },
  { date: '2026-05-01', name: 'Fiesta del Trabajo' },
  { date: '2026-08-15', name: 'Asunción de la Virgen' },
  { date: '2026-10-12', name: 'Fiesta Nacional de España' },
  { date: '2026-11-01', name: 'Todos los Santos' },
  { date: '2026-12-06', name: 'Día de la Constitución Española' },
  { date: '2026-12-08', name: 'La Inmaculada Concepción' },
  { date: '2026-12-25', name: 'Natividad del Señor' },
]

// Regional holidays supplement the national ones above
const REGIONAL_2026: Record<string, HolidayDay[]> = {
  'ES-AN': [
    ...NATIONAL_2026,
    { date: '2026-02-28', name: 'Día de Andalucía' },
    { date: '2026-04-02', name: 'Jueves Santo' },
  ],
  'ES-AR': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-04-23', name: 'Día de Aragón' },
  ],
  'ES-AS': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-09-08', name: 'Día de Asturias' },
  ],
  'ES-IB': [
    ...NATIONAL_2026,
    { date: '2026-03-01', name: 'Dia de les Illes Balears' },
    { date: '2026-04-06', name: 'Dilluns de Pasqua' },
  ],
  'ES-CN': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-05-30', name: 'Día de Canarias' },
  ],
  'ES-CB': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-07-28', name: 'Día de las Instituciones de Cantabria' },
  ],
  'ES-CL': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-04-23', name: 'Día de Castilla y León' },
  ],
  'ES-CM': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-06-04', name: 'Corpus Christi' },
  ],
  'ES-CT': [
    ...NATIONAL_2026,
    { date: '2026-04-06', name: 'Dilluns de Pasqua' },
    { date: '2026-06-24', name: 'Sant Joan' },
    { date: '2026-09-11', name: 'Diada Nacional de Catalunya' },
    { date: '2026-12-26', name: 'Sant Esteve' },
  ],
  'ES-EX': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-09-08', name: 'Día de Extremadura' },
  ],
  'ES-GA': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-07-25', name: 'Día de Galicia' },
  ],
  'ES-MD': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-05-02', name: 'Fiesta de la Comunidad de Madrid' },
    { date: '2026-11-09', name: 'Nuestra Señora de la Almudena' },
  ],
  'ES-MC': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-06-09', name: 'Día de la Región de Murcia' },
  ],
  'ES-NC': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-12-03', name: 'San Francisco Javier' },
  ],
  'ES-PV': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-07-25', name: 'Santiago Apóstol' },
  ],
  'ES-RI': [
    ...NATIONAL_2026,
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-06-09', name: 'Día de La Rioja' },
  ],
  'ES-VC': [
    ...NATIONAL_2026,
    { date: '2026-04-06', name: 'Dilluns de Pasqua' },
    { date: '2026-10-09', name: 'Dia de la Comunitat Valenciana' },
  ],
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('🌱 Starting seed...\n')

  // 1. Organization
  console.log('→ Creating organization...')
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Gut',
      slug: 'gut',
      currency: 'EUR',
      timezone: 'Europe/Madrid',
      defaultWeeklyHours: '37.5',
      dailyHoursSoftCap: '14',
      defaultRenewalBehavior: 'reset',
    })
    .returning()

  if (!org) throw new Error('Failed to create organization')
  console.log(`  ✅ Organization: ${org.name} (${org.id})\n`)

  // 2. Persons + auth users
  console.log('→ Creating persons...')
  for (const u of SEED_USERS) {
    const hashed = await hashPassword(u.password)
    const userId = generateId()
    const now = new Date()

    await db.insert(user).values({
      id: userId,
      name: u.name,
      email: u.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(account).values({
      id: generateId(),
      accountId: u.email,
      providerId: 'credential',
      userId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(persons).values({
      userId,
      organizationId: org.id,
      name: u.name,
      email: u.email,
      appRole: u.appRole,
      professionalCategory: u.professionalCategory,
      primaryArea: u.primaryArea,
      holidayRegion: u.holidayRegion,
    })

    console.log(`  ✅ ${u.email} (${u.appRole} / ${u.professionalCategory} / ${u.primaryArea})`)
  }
  console.log()

  // 3. Org-level rates
  console.log('→ Creating org-level rates...')
  await db.insert(rates).values(
    ORG_RATES.map((r) => ({
      organizationId: org.id,
      area: r.area,
      role: r.role,
      costRateCents: r.costRateCents,
      soldRateCents: r.soldRateCents,
      effectiveFrom: today(),
    })),
  )
  console.log(`  ✅ ${ORG_RATES.length} rates (3 areas × 6 roles)\n`)

  // 4. Holiday presets 2026
  console.log('→ Creating holiday presets 2026...')

  // Nacional
  await db.insert(holidayPresets).values({
    region: 'ES',
    year: 2026,
    dates: NATIONAL_2026,
  })
  console.log(`  ✅ ES (nacional) — ${NATIONAL_2026.length} festivos`)

  // CC.AA.
  for (const [region, dates] of Object.entries(REGIONAL_2026)) {
    await db.insert(holidayPresets).values({ region, year: 2026, dates })
    console.log(`  ✅ ${region} — ${dates.length} festivos`)
  }

  console.log('\n🎉 Seed complete!')
  console.log('\nCredenciales de prueba:')
  console.log('  admin@gut.com       / Admin1234!')
  console.log('  manager@gut.com     / Manager1234!')
  console.log('  contributor@gut.com / Contrib1234!')
}

seed().catch(console.error).finally(() => process.exit())
