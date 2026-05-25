/**
 * Fixtures script — Phase 02
 * Run: pnpm db:fixtures
 *
 * Requires seed data (pnpm db:seed) to exist first.
 * Creates:
 *   - 1 Workspace (Gut Main)
 *   - 2 Projects (Gut Rebrand, Nodox Web)
 *   - Assignments for all 3 persons on both projects
 */
import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { organizations, persons, projectAssignments, projects, workspaces } from './schema'

async function fixtures() {
  console.log('🔧 Loading fixtures...\n')

  const [org] = await db.select().from(organizations).limit(1)
  if (!org) throw new Error('No org found — run `pnpm db:seed` first.')

  const allPersons = await db
    .select()
    .from(persons)
    .where(eq(persons.organizationId, org.id))

  if (allPersons.length === 0) throw new Error('No persons found — run `pnpm db:seed` first.')

  const admin = allPersons.find((p) => p.appRole === 'admin')
  if (!admin) throw new Error('Admin person not found.')

  const today = new Date().toISOString().split('T')[0] as string

  // 1. Workspace
  console.log('→ Creating workspace...')
  const [workspace] = await db
    .insert(workspaces)
    .values({
      organizationId: org.id,
      name: 'Gut Main',
      status: 'active',
      createdBy: admin.id,
    })
    .returning()
  if (!workspace) throw new Error('Failed to create workspace.')
  console.log(`  ✅ Workspace: ${workspace.name} (${workspace.id})\n`)

  // 2. Projects
  console.log('→ Creating projects...')
  const [rebrand] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      workspaceId: workspace.id,
      name: 'Gut Rebrand',
      type: 'fixed_bag',
      areasEnabled: ['ux', 'ui', 'research'],
      originalAllocation: {},
      status: 'active',
      startDate: today,
    })
    .returning()

  const [nodoxWeb] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      workspaceId: workspace.id,
      name: 'Nodox Web',
      type: 'ongoing_capacity',
      areasEnabled: ['ux', 'ui'],
      originalAllocation: {},
      status: 'active',
      startDate: today,
    })
    .returning()

  if (!rebrand || !nodoxWeb) throw new Error('Failed to create projects.')
  console.log(`  ✅ ${rebrand.name} (${rebrand.id})`)
  console.log(`  ✅ ${nodoxWeb.name} (${nodoxWeb.id})\n`)

  // 3. Assignments — all persons on both projects
  console.log('→ Creating assignments...')
  for (const person of allPersons) {
    await db.insert(projectAssignments).values({
      organizationId: org.id,
      projectId: rebrand.id,
      personId: person.id,
      allowedAreas: ['ux', 'ui', 'research'],
    })
    await db.insert(projectAssignments).values({
      organizationId: org.id,
      projectId: nodoxWeb.id,
      personId: person.id,
      allowedAreas: ['ux', 'ui'],
    })
    console.log(`  ✅ ${person.email} → Gut Rebrand + Nodox Web`)
  }

  console.log('\n🎉 Fixtures complete!')
}

fixtures().catch(console.error).finally(() => process.exit())
