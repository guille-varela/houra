/**
 * Seed DEMO — organización aislada para enseñar el producto.
 * Run: pnpm db:seed-demo
 *
 * Crea una org "Studio Demo" (slug 'demo') SEPARADA de Gut, con datos ricos:
 *   - 12 personas (avatares variados) + logins
 *   - tarifas org (4 áreas × 6 roles), festivos reutilizados si existen
 *   - 3 cuentas, 8 clientes (alguno con acuerdo marco)
 *   - 16 proyectos variados (bolsa fija/renovable, capacidad, cuota mensual, por fases)
 *   - asignaciones CON dedicación (para autorellenar horas)
 *   - amendments, vacaciones
 *   - 14 meses de imputaciones (Insights + comparativas PoP/YoY)
 *   - rollup insights_monthly poblado para meses pasados
 *
 * Idempotente: borra la org 'demo' previa (en cascada manual) antes de recrear.
 * NO toca la org Gut.
 */
import { eq, inArray } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { nanoid } from 'nanoid'
import { db } from '../lib/db'
import {
  account,
  amendments,
  clients,
  holidayPresets,
  insightsMonthly,
  organizations,
  persons,
  projectAssignments,
  projects,
  rates,
  timeEntries,
  timeOffEntries,
  user,
  workspaces,
} from './schema'

const DEMO_SLUG = 'demo'
const DEMO_PASSWORD = 'Demo1234!'
const id = () => nanoid(24)

// ─── Tarifas por área×rol (céntimos) ──────────────────────────────────────────
type Role = 'trainee' | 'junior' | 'mid' | 'senior' | 'lead' | 'head'
type Area = 'research' | 'ux' | 'ui' | 'cro'
const RATE: Record<Area, Record<Role, { cost: number; sold: number }>> = {
  research: { trainee: { cost: 1500, sold: 2000 }, junior: { cost: 2500, sold: 3800 }, mid: { cost: 4000, sold: 6000 }, senior: { cost: 5500, sold: 7500 }, lead: { cost: 6500, sold: 9000 }, head: { cost: 8500, sold: 11500 } },
  ux: { trainee: { cost: 1500, sold: 2000 }, junior: { cost: 2800, sold: 4000 }, mid: { cost: 4000, sold: 6000 }, senior: { cost: 5500, sold: 7500 }, lead: { cost: 7000, sold: 9500 }, head: { cost: 9000, sold: 12000 } },
  ui: { trainee: { cost: 1500, sold: 2000 }, junior: { cost: 2800, sold: 4000 }, mid: { cost: 3800, sold: 5500 }, senior: { cost: 5000, sold: 7000 }, lead: { cost: 6500, sold: 9000 }, head: { cost: 8500, sold: 11500 } },
  cro: { trainee: { cost: 1600, sold: 2200 }, junior: { cost: 3000, sold: 4300 }, mid: { cost: 4300, sold: 6300 }, senior: { cost: 5800, sold: 8000 }, lead: { cost: 7200, sold: 9800 }, head: { cost: 9200, sold: 12500 } },
}

// ─── Equipo demo (12 personas) ────────────────────────────────────────────────
type Member = {
  name: string
  area: Area
  role: Role
  appRole: 'admin' | 'manager' | 'contributor'
  region: string
  avatarType: 'initials' | 'generated'
  avatarVariant?: string
}
const TEAM: Member[] = [
  { name: 'Demo Admin', area: 'ux', role: 'lead', appRole: 'admin', region: 'ES-MD', avatarType: 'generated', avatarVariant: 'beam' },
  { name: 'Lucía Romero', area: 'ux', role: 'head', appRole: 'manager', region: 'ES-MD', avatarType: 'initials' },
  { name: 'Marc Soler', area: 'ui', role: 'head', appRole: 'manager', region: 'ES-CT', avatarType: 'generated', avatarVariant: 'marble' },
  { name: 'Nadia Khan', area: 'research', role: 'lead', appRole: 'contributor', region: 'ES-MD', avatarType: 'initials' },
  { name: 'Pablo Ferrer', area: 'ui', role: 'senior', appRole: 'contributor', region: 'ES-VC', avatarType: 'generated', avatarVariant: 'bauhaus' },
  { name: 'Sara Ortega', area: 'ux', role: 'senior', appRole: 'contributor', region: 'ES-MD', avatarType: 'initials' },
  { name: 'Tomás Vidal', area: 'cro', role: 'lead', appRole: 'contributor', region: 'ES-CT', avatarType: 'generated', avatarVariant: 'sunset' },
  { name: 'Elena Cruz', area: 'ui', role: 'mid', appRole: 'contributor', region: 'ES-AN', avatarType: 'initials' },
  { name: 'Iván Mora', area: 'ux', role: 'mid', appRole: 'contributor', region: 'ES-MD', avatarType: 'generated', avatarVariant: 'ring' },
  { name: 'Carmen Gil', area: 'research', role: 'mid', appRole: 'contributor', region: 'ES-GA', avatarType: 'initials' },
  { name: 'Dani Reyes', area: 'ui', role: 'junior', appRole: 'contributor', region: 'ES-MD', avatarType: 'generated', avatarVariant: 'pixel' },
  { name: 'Aitor Blanco', area: 'cro', role: 'junior', appRole: 'contributor', region: 'ES-CL', avatarType: 'initials' },
]

// ─── Clientes (8, alguno con acuerdo marco) ───────────────────────────────────
const CLIENT_NAMES = ['Aurora Bank', 'Nimbus Retail', 'Vela Health', 'Orbit Media', 'Kestrel Energy', 'Lumen Foods', 'Pangea Travel', 'Titan Logistics']
const MARCO_CLIENTS = new Set(['Aurora Bank', 'Kestrel Energy'])

// ─── Proyectos (plantillas) ───────────────────────────────────────────────────
type ProjType = 'fixed_bag' | 'renewable_bag' | 'ongoing_capacity'
type Billing = 'hour_bag' | 'monthly_fee' | 'by_phase'
type Status = 'active' | 'paused' | 'closed' | 'draft'
type ProjTpl = {
  name: string
  client: string
  type: ProjType
  billing: Billing
  status: Status
  areas: Area[]
  // bolsa: matriz area→role→horas (solo bolsas); capacidad/cuota → {}
  bag?: Partial<Record<Area, Partial<Record<Role, number>>>>
  monthlyFee?: number // céntimos/mes (informativo)
  margin: number
}
const PROJECTS: ProjTpl[] = [
  { name: 'Aurora — App Banca', client: 'Aurora Bank', type: 'fixed_bag', billing: 'hour_bag', status: 'active', areas: ['ux', 'ui'], bag: { ux: { lead: 120, senior: 300 }, ui: { senior: 280, mid: 200 } }, margin: 32 },
  { name: 'Aurora — Research continuo', client: 'Aurora Bank', type: 'ongoing_capacity', billing: 'monthly_fee', status: 'active', areas: ['research'], monthlyFee: 1200000, margin: 28 },
  { name: 'Nimbus — Rediseño e-commerce', client: 'Nimbus Retail', type: 'fixed_bag', billing: 'by_phase', status: 'active', areas: ['ux', 'ui', 'research'], bag: { research: { mid: 80 }, ux: { senior: 220, mid: 180 }, ui: { senior: 240, junior: 160 } }, margin: 30 },
  { name: 'Nimbus — CRO trimestral', client: 'Nimbus Retail', type: 'ongoing_capacity', billing: 'monthly_fee', status: 'active', areas: ['cro'], monthlyFee: 900000, margin: 35 },
  { name: 'Vela — Portal paciente', client: 'Vela Health', type: 'fixed_bag', billing: 'hour_bag', status: 'active', areas: ['ux', 'ui'], bag: { ux: { lead: 90, mid: 220 }, ui: { senior: 200, junior: 140 } }, margin: 26 },
  { name: 'Vela — Design system', client: 'Vela Health', type: 'renewable_bag', billing: 'hour_bag', status: 'active', areas: ['ui'], bag: { ui: { lead: 80, senior: 160 } }, margin: 38 },
  { name: 'Orbit — Capacidad UI', client: 'Orbit Media', type: 'ongoing_capacity', billing: 'monthly_fee', status: 'active', areas: ['ui'], monthlyFee: 1500000, margin: 24 },
  { name: 'Orbit — Web institucional', client: 'Orbit Media', type: 'fixed_bag', billing: 'by_phase', status: 'closed', areas: ['ux', 'ui'], bag: { ux: { mid: 120 }, ui: { mid: 160, junior: 90 } }, margin: 33 },
  { name: 'Kestrel — Dashboard energía', client: 'Kestrel Energy', type: 'fixed_bag', billing: 'hour_bag', status: 'active', areas: ['ux', 'ui', 'cro'], bag: { ux: { senior: 200 }, ui: { senior: 220, mid: 140 }, cro: { lead: 90 } }, margin: 29 },
  { name: 'Kestrel — Optimización funnel', client: 'Kestrel Energy', type: 'ongoing_capacity', billing: 'monthly_fee', status: 'paused', areas: ['cro'], monthlyFee: 800000, margin: 31 },
  { name: 'Lumen — App pedidos', client: 'Lumen Foods', type: 'fixed_bag', billing: 'hour_bag', status: 'active', areas: ['ux', 'ui'], bag: { ux: { mid: 180 }, ui: { senior: 200, junior: 120 } }, margin: 27 },
  { name: 'Lumen — Research mercado', client: 'Lumen Foods', type: 'fixed_bag', billing: 'by_phase', status: 'active', areas: ['research'], bag: { research: { lead: 60, mid: 140 } }, margin: 36 },
  { name: 'Pangea — Buscador viajes', client: 'Pangea Travel', type: 'fixed_bag', billing: 'hour_bag', status: 'active', areas: ['ux', 'ui'], bag: { ux: { senior: 240, mid: 160 }, ui: { senior: 260 } }, margin: 22 },
  { name: 'Pangea — Capacidad producto', client: 'Pangea Travel', type: 'ongoing_capacity', billing: 'monthly_fee', status: 'active', areas: ['ux', 'ui'], monthlyFee: 2000000, margin: 25 },
  { name: 'Titan — Panel logística', client: 'Titan Logistics', type: 'fixed_bag', billing: 'hour_bag', status: 'active', areas: ['ui', 'cro'], bag: { ui: { senior: 180, mid: 120 }, cro: { senior: 100 } }, margin: 30 },
  { name: 'Titan — Discovery 2026', client: 'Titan Logistics', type: 'fixed_bag', billing: 'by_phase', status: 'draft', areas: ['research', 'ux'], bag: { research: { mid: 100 }, ux: { senior: 120 } }, margin: 34 },
]

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}
function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}
function rnd(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 4) / 4
}

async function cleanupDemoOrg() {
  const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, DEMO_SLUG)).limit(1)
  if (!existing) return
  const orgId = existing.id
  console.log(`→ Limpiando org demo previa (${orgId})...`)
  // Orden inverso de dependencias.
  await db.delete(insightsMonthly).where(eq(insightsMonthly.organizationId, orgId))
  await db.delete(timeEntries).where(eq(timeEntries.organizationId, orgId))
  await db.delete(timeOffEntries).where(eq(timeOffEntries.organizationId, orgId))
  await db.delete(amendments).where(eq(amendments.organizationId, orgId))
  await db.delete(projectAssignments).where(eq(projectAssignments.organizationId, orgId))
  await db.delete(projects).where(eq(projects.organizationId, orgId))
  await db.delete(clients).where(eq(clients.organizationId, orgId))
  await db.delete(workspaces).where(eq(workspaces.organizationId, orgId))
  await db.delete(rates).where(eq(rates.organizationId, orgId))
  const personRows = await db.select({ id: persons.id, userId: persons.userId }).from(persons).where(eq(persons.organizationId, orgId))
  const userIds = personRows.map((p) => p.userId)
  await db.delete(persons).where(eq(persons.organizationId, orgId))
  if (userIds.length) {
    await db.delete(account).where(inArray(account.userId, userIds))
    await db.delete(user).where(inArray(user.id, userIds))
  }
  await db.delete(organizations).where(eq(organizations.id, orgId))
  console.log('  ✅ Limpieza completa\n')
}

async function seed() {
  console.log('🌱 Seed DEMO (org aislada)...\n')
  await cleanupDemoOrg()

  // 1. Org
  const [org] = await db.insert(organizations).values({
    name: 'Studio Demo', slug: DEMO_SLUG, currency: 'EUR', timezone: 'Europe/Madrid',
    defaultWeeklyHours: '37.5', dailyHoursSoftCap: '14', defaultRenewalBehavior: 'reset',
  }).returning()
  if (!org) throw new Error('org demo no creada')
  console.log(`→ Org: ${org.name} (${org.id})`)

  // 2. Personas + logins
  const hashed = await hashPassword(DEMO_PASSWORD)
  const personIds: string[] = []
  const personMeta: Array<Member & { id: string }> = []
  for (let i = 0; i < TEAM.length; i++) {
    const m = TEAM[i]!
    const email = i === 0 ? 'demo@houra.app' : `${m.name.toLowerCase().replace(/[^a-z]+/g, '.')}@houra.app`
    const userId = id()
    const now = new Date()
    await db.insert(user).values({ id: userId, name: m.name, email, emailVerified: true, createdAt: now, updatedAt: now })
    await db.insert(account).values({ id: id(), accountId: email, providerId: 'credential', userId, password: hashed, createdAt: now, updatedAt: now })
    const [p] = await db.insert(persons).values({
      userId, organizationId: org.id, name: m.name, email,
      appRole: m.appRole, professionalCategory: m.role, primaryArea: m.area, holidayRegion: m.region,
      avatarType: m.avatarType, avatarVariant: m.avatarVariant ?? null,
    }).returning({ id: persons.id })
    personIds.push(p!.id)
    personMeta.push({ ...m, id: p!.id })
  }
  console.log(`→ ${personMeta.length} personas (login: demo@houra.app / ${DEMO_PASSWORD})`)

  // 3. Tarifas org (4 áreas × 6 roles)
  const today = ymd(new Date())
  const rateRows: Array<typeof rates.$inferInsert> = []
  for (const area of Object.keys(RATE) as Area[]) {
    for (const role of Object.keys(RATE[area]) as Role[]) {
      rateRows.push({ organizationId: org.id, area, role, costRateCents: RATE[area][role].cost, soldRateCents: RATE[area][role].sold, effectiveFrom: '2024-01-01' })
    }
  }
  await db.insert(rates).values(rateRows)
  console.log(`→ ${rateRows.length} tarifas`)

  // 4. Cuentas
  const wsNames = ['Producto Digital', 'Growth & CRO', 'Innovación']
  const wsIds: string[] = []
  for (const name of wsNames) {
    const [w] = await db.insert(workspaces).values({ organizationId: org.id, name, status: 'active', createdBy: personIds[0]! }).returning({ id: workspaces.id })
    wsIds.push(w!.id)
  }

  // 5. Clientes
  const clientId = new Map<string, string>()
  for (const name of CLIENT_NAMES) {
    const marco = MARCO_CLIENTS.has(name)
    const [c] = await db.insert(clients).values({
      organizationId: org.id, name,
      hasMarco: marco,
      marcoStartDate: marco ? '2025-01-01' : null,
      marcoEndDate: marco ? '2026-12-31' : null,
      marcoUsePerRoleRates: false,
      marcoGlobalRateCents: marco ? 6500 : null,
    }).returning({ id: clients.id })
    clientId.set(name, c!.id)
  }
  console.log(`→ ${CLIENT_NAMES.length} clientes`)

  // 6. Proyectos
  const projIds: Array<{ id: string; tpl: ProjTpl }> = []
  for (let i = 0; i < PROJECTS.length; i++) {
    const t = PROJECTS[i]!
    const [pr] = await db.insert(projects).values({
      organizationId: org.id,
      workspaceId: wsIds[i % wsIds.length]!,
      clientId: clientId.get(t.client)!,
      name: t.name,
      type: t.type,
      billingModel: t.billing,
      areasEnabled: t.areas,
      originalAllocation: (t.bag ?? {}) as Record<string, Record<string, number>>,
      weeklyHours: '37.5',
      status: t.status,
      startDate: '2025-01-15',
      targetMarginPercent: String(t.margin),
      ...(t.status === 'closed' ? { closedAt: new Date() } : {}),
    }).returning({ id: projects.id })
    projIds.push({ id: pr!.id, tpl: t })
  }
  console.log(`→ ${projIds.length} proyectos`)

  // 7. Asignaciones (+ dedicación para capacidad/cuota) y plan de imputación
  type Plan = { personId: string; projectId: string; area: Area; role: Role; monthlyHours: number }
  const plans: Plan[] = []
  for (const { id: pId, tpl } of projIds) {
    if (tpl.status === 'draft') continue // draft: sin asignaciones activas
    // Elegir 2-4 personas cuya área ∈ áreas del proyecto.
    const candidates = personMeta.filter((p) => tpl.areas.includes(p.area))
    const chosen = candidates.slice(0, Math.min(4, Math.max(2, candidates.length)))
    const isCapacity = tpl.type === 'ongoing_capacity' || tpl.billing === 'monthly_fee'
    for (const p of chosen) {
      const dedicationPct = isCapacity ? [25, 40, 50, 60][Math.floor(Math.random() * 4)]! : null
      const monthlyHours = dedicationPct ? Math.round((37.5 / 5) * 21 * (dedicationPct / 100)) : Math.round(rnd(12, 28))
      await db.insert(projectAssignments).values({
        organizationId: org.id, projectId: pId, personId: p.id,
        allowedAreas: [p.area], isActive: tpl.status !== 'closed',
        ...(isCapacity
          ? { autoFillEnabled: true, autoFillMode: 'percent' as const, dedicationPercent: String(dedicationPct), autoFillArea: p.area, effectiveFrom: '2025-01-01' }
          : {}),
      })
      plans.push({ personId: p.id, projectId: pId, area: p.area, role: p.role, monthlyHours })
    }
  }
  console.log(`→ ${plans.length} asignaciones (con dedicación en capacidad/cuota)`)

  // 8. Amendments (ajuste de bolsa en 3 proyectos de bolsa)
  const bagProjects = projIds.filter((p) => p.tpl.bag && Object.keys(p.tpl.bag).length > 0).slice(0, 3)
  for (const bp of bagProjects) {
    const area = bp.tpl.areas[0]!
    await db.insert(amendments).values({
      organizationId: org.id, projectId: bp.id,
      deltaAllocation: { [area]: { senior: 40 } } as Record<string, Record<string, number>>,
      reason: 'Ampliación de alcance acordada con cliente',
      effectiveDate: '2025-09-01', createdBy: personIds[0]!,
    })
  }
  console.log(`→ ${bagProjects.length} amendments`)

  // 9. Imputaciones — 14 meses hacia atrás (incluye mes en curso)
  const now = new Date()
  const curY = now.getUTCFullYear()
  const curM = now.getUTCMonth() // 0-based
  type Fact = { month: string; projectId: string; personId: string; area: string; hours: number; rev: number; cost: number }
  const facts: Fact[] = []
  const teMonth: Array<typeof timeEntries.$inferInsert> = []
  for (let back = 13; back >= 0; back--) {
    const d = new Date(Date.UTC(curY, curM - back, 15))
    const mDay = ymd(d)
    const monthFirst = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`
    for (const pl of plans) {
      // variación mensual ±25%, algún mes a 0 para realismo
      if (Math.random() < 0.06) continue
      const hours = Math.max(1, Math.round(pl.monthlyHours * (0.75 + Math.random() * 0.5) * 4) / 4)
      const r = RATE[pl.area][pl.role]
      teMonth.push({
        organizationId: org.id, personId: pl.personId, projectId: pl.projectId,
        date: mDay, hours: String(hours), area: pl.area,
        costRateAtEntryCents: r.cost, soldRateAtEntryCents: r.sold, source: 'manual',
      })
      // acumular fact para rollup (meses pasados)
      const isPast = d.getUTCFullYear() < curY || (d.getUTCFullYear() === curY && d.getUTCMonth() < curM)
      if (isPast) {
        facts.push({ month: monthFirst, projectId: pl.projectId, personId: pl.personId, area: pl.area, hours, rev: Math.round(hours * r.sold), cost: Math.round(hours * r.cost) })
      }
    }
  }
  // insertar time_entries en lotes
  for (let i = 0; i < teMonth.length; i += 200) {
    await db.insert(timeEntries).values(teMonth.slice(i, i + 200))
  }
  console.log(`→ ${teMonth.length} imputaciones (14 meses)`)

  // 10. Vacaciones (verano + navidad para ~media plantilla)
  const offRows: Array<typeof timeOffEntries.$inferInsert> = []
  for (let pi = 0; pi < personMeta.length; pi += 2) {
    const pid = personMeta[pi]!.id
    for (const day of ['2025-08-11', '2025-08-12', '2025-08-13', '2025-08-14', '2025-12-26', '2025-12-29', '2025-12-30']) {
      offRows.push({ organizationId: org.id, personId: pid, date: day, type: 'vacation' as const })
    }
  }
  if (offRows.length) await db.insert(timeOffEntries).values(offRows)
  console.log(`→ ${offRows.length} días de vacaciones`)

  // 11. Rollup insights_monthly (agregado por grano para meses pasados)
  const grain = new Map<string, Fact & { entryCount: number }>()
  for (const f of facts) {
    const key = `${f.month}|${f.projectId}|${f.personId}|${f.area}`
    const g = grain.get(key)
    if (g) { g.hours += f.hours; g.rev += f.rev; g.cost += f.cost; g.entryCount += 1 }
    else grain.set(key, { ...f, entryCount: 1 })
  }
  const rollupRows = [...grain.values()].map((g) => ({
    organizationId: org.id, month: g.month, projectId: g.projectId, personId: g.personId,
    area: g.area, hours: String(g.hours), revenueCents: g.rev, costCents: g.cost, entryCount: g.entryCount,
  }))
  for (let i = 0; i < rollupRows.length; i += 200) {
    await db.insert(insightsMonthly).values(rollupRows.slice(i, i + 200))
  }
  console.log(`→ ${rollupRows.length} filas de rollup insights_monthly`)

  console.log('\n🎉 Seed DEMO completo.')
  console.log(`\nLogin demo:  demo@houra.app  /  ${DEMO_PASSWORD}  (org "Studio Demo")`)
}

seed().catch(console.error).finally(() => process.exit())
