'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db'
import { organizations, reports, reportSnapshots } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { notifySlack } from '@/lib/notify'
import {
  hashReportPassword,
  checkReportPassword,
  createReportToken,
} from '@/lib/report-auth'
import { createReportSchema, verifyReportPasswordSchema } from '@/lib/schemas/report'
import { buildProjectSnapshot, buildWorkspaceSnapshot } from '@/lib/report-data'

export async function createReport(raw: unknown) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const parsed = createReportSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { scope, scopeId, password } = parsed.data
  const slug = nanoid(10)
  const passwordHash = password ? await hashReportPassword(password) : null

  const [report] = await db
    .insert(reports)
    .values({
      organizationId: person.organizationId,
      scope,
      scopeId,
      shareUrlSlug: slug,
      passwordHash,
      createdBy: person.id,
    })
    .returning()

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    action: 'report.create',
    entityType: 'report',
    entityId: report!.id,
    diff: { before: null, after: { scope, scopeId, slug } },
  })

  await notifySlack(`🔗 Report compartido (${scope}) por ${person.name}: /r/${slug}`)

  revalidatePath(`/projects/${scopeId}`)
  return { ok: true as const, slug }
}

export async function closeReport(reportId: string) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const [report] = await db
    .select({ organizationId: reports.organizationId })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1)

  if (!report) return { ok: false as const, error: 'Report no encontrado' }

  await db.update(reports).set({ status: 'closed', updatedAt: new Date() }).where(eq(reports.id, reportId))

  await logAuditEvent({
    organizationId: report.organizationId,
    actorId: person.id,
    action: 'report.close',
    entityType: 'report',
    entityId: reportId,
    diff: { before: { status: 'open' }, after: { status: 'closed' } },
  })

  revalidatePath('/projects')
  return { ok: true as const }
}

export async function takeManualSnapshot(reportId: string, label: string) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1)

  if (!report) return { ok: false as const, error: 'Report no encontrado' }
  if (report.status === 'closed') return { ok: false as const, error: 'Report cerrado' }

  let frozenData: unknown
  if (report.scope === 'project') {
    frozenData = await buildProjectSnapshot(report.scopeId)
  } else if (report.scope === 'workspace') {
    frozenData = await buildWorkspaceSnapshot(report.scopeId)
  } else {
    return { ok: false as const, error: `Scope no soportado: ${report.scope}` }
  }

  await db.insert(reportSnapshots).values({
    reportId,
    frozenData,
    label: label || new Date().toLocaleDateString('es-ES'),
  })

  await logAuditEvent({
    organizationId: report.organizationId,
    actorId: person.id,
    action: 'report.snapshot.create',
    entityType: 'report',
    entityId: reportId,
    diff: { before: null, after: { label, scope: report.scope } },
  })

  return { ok: true as const }
}

// Called from the public /r/[slug] password form
export async function verifyReportAccess(raw: unknown) {
  const parsed = verifyReportPasswordSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Datos inválidos' }

  const { slug, password } = parsed.data

  const [report] = await db
    .select({ id: reports.id, passwordHash: reports.passwordHash, organizationId: reports.organizationId })
    .from(reports)
    .where(and(eq(reports.shareUrlSlug, slug), eq(reports.status, 'open')))
    .limit(1)

  if (!report) return { ok: false as const, error: 'Report no encontrado o cerrado' }

  // Determine which hash to check against
  let hashToCheck = report.passwordHash
  if (!hashToCheck) {
    const [org] = await db
      .select({ reportDefaultPasswordHash: organizations.reportDefaultPasswordHash })
      .from(organizations)
      .where(eq(organizations.id, report.organizationId))
      .limit(1)
    hashToCheck = org?.reportDefaultPasswordHash ?? null
  }

  // No hash = open report (no password required)
  if (!hashToCheck) {
    const token = await createReportToken(slug)
    const cookieStore = await cookies()
    cookieStore.set(`rp_${slug}`, token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400,
      path: `/r/${slug}`,
    })
    return { ok: true as const }
  }

  const valid = await checkReportPassword(hashToCheck, password)
  if (!valid) return { ok: false as const, error: 'Contraseña incorrecta' }

  const token = await createReportToken(slug)
  const cookieStore = await cookies()
  cookieStore.set(`rp_${slug}`, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400,
    path: `/r/${slug}`,
  })
  return { ok: true as const }
}

// "Compartir con comité" — creates a workspace report with org-default password + monthly snapshot schedule
export async function shareWithCommittee(workspaceId: string) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const slug = nanoid(10)

  const [report] = await db
    .insert(reports)
    .values({
      organizationId: person.organizationId,
      scope: 'workspace',
      scopeId: workspaceId,
      shareUrlSlug: slug,
      passwordHash: null,  // inherits org default
      autoSnapshotSchedule: { day: 22 },  // monthly, day 22 — executed by Inngest in Phase 06
      createdBy: person.id,
    })
    .returning()

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    action: 'report.share_with_committee',
    entityType: 'report',
    entityId: report!.id,
    diff: { before: null, after: { workspaceId, slug } },
  })

  revalidatePath(`/workspaces/${workspaceId}`)
  return { ok: true as const, slug }
}
