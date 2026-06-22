'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { autoFillRuns, projectAssignments, timeEntries } from '@/db/schema'
import { getOrganizationContext, requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { computeAutoFillForScope, type AutoFillScope, type AutoFillScopeResult } from '@/lib/auto-fill-data'
import type { AutoFillMode } from '@/lib/auto-fill'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

type PreviewResult =
  | { ok: true; result: AutoFillScopeResult }
  | { ok: false; error: string }

type CommitResult =
  | { ok: true; runId: string; inserted: number; skipped: number }
  | { ok: false; error: string }

type ActionResult = { ok: true } | { ok: false; error: string }

function validPeriod(periodStart: string, periodEnd: string): string | null {
  if (!ISO_RE.test(periodStart) || !ISO_RE.test(periodEnd)) return 'Periodo inválido.'
  if (periodStart > periodEnd) return 'La fecha de inicio es posterior a la de fin.'
  return null
}

/** Calcula el reparto propuesto SIN escribir nada (preview). */
export async function previewAutoFill(input: {
  periodStart: string
  periodEnd: string
  scope?: AutoFillScope
}): Promise<PreviewResult> {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false, error: 'Necesitas permisos de manager.' }
  }
  const periodErr = validPeriod(input.periodStart, input.periodEnd)
  if (periodErr) return { ok: false, error: periodErr }

  try {
    const result = await computeAutoFillForScope(
      person.organizationId,
      { periodStart: input.periodStart, periodEnd: input.periodEnd },
      input.scope ?? {},
    )
    return { ok: true, result }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al calcular el preview.' }
  }
}

/** Recalcula, crea el run y escribe las entradas (reconciliando las auto previas). */
export async function commitAutoFill(input: {
  periodStart: string
  periodEnd: string
  scope?: AutoFillScope
}): Promise<CommitResult> {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false, error: 'Necesitas permisos de manager.' }
  }
  const periodErr = validPeriod(input.periodStart, input.periodEnd)
  if (periodErr) return { ok: false, error: periodErr }

  const orgId = person.organizationId
  const { periodStart, periodEnd } = input

  let result: AutoFillScopeResult
  try {
    result = await computeAutoFillForScope(orgId, { periodStart, periodEnd }, input.scope ?? {})
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al calcular.' }
  }

  const validRows = result.rows.filter((r) => !r.error && r.entries.length > 0)
  const skipped = result.rows.length - validRows.length
  if (validRows.length === 0) {
    return { ok: false, error: 'No hay nada que confirmar (sin asignaciones válidas con horas).' }
  }

  // Crear el run (committed) para tener el runId con el que marcar las entradas.
  const [run] = await db
    .insert(autoFillRuns)
    .values({
      organizationId: orgId,
      periodStart,
      periodEnd,
      triggeredBy: person.id,
      triggerType: 'manual',
      status: 'committed',
      summary: result.totals,
    })
    .returning({ id: autoFillRuns.id })

  if (!run) return { ok: false, error: 'No se pudo crear el run de autorelleno.' }

  // Reconciliación: por cada persona×proyecto, borrar las auto previas del periodo y
  // reinsertar. (neon-http no soporta transacciones interactivas → delete + insert.)
  let inserted = 0
  for (const row of validRows) {
    await db
      .delete(timeEntries)
      .where(
        and(
          eq(timeEntries.organizationId, orgId),
          eq(timeEntries.personId, row.personId),
          eq(timeEntries.projectId, row.projectId),
          eq(timeEntries.source, 'auto_fill'),
          gte(timeEntries.date, periodStart),
          lte(timeEntries.date, periodEnd),
        ),
      )

    const values = row.entries.map((e) => ({
      organizationId: orgId,
      personId: row.personId,
      projectId: row.projectId,
      date: e.date,
      hours: String(e.hours),
      area: row.area,
      description: null,
      costRateAtEntryCents: e.costRateCents,
      soldRateAtEntryCents: e.soldRateCents,
      source: 'auto_fill' as const,
      autoFillRunId: run.id,
    }))
    if (values.length > 0) {
      await db.insert(timeEntries).values(values)
      inserted += values.length
    }
  }

  await logAuditEvent({
    organizationId: orgId,
    actorId: person.id,
    action: 'time_entry.auto_fill',
    entityType: 'auto_fill_run',
    entityId: run.id,
    diff: { before: null, after: { periodStart, periodEnd, inserted, ...result.totals } },
  })

  revalidatePath('/auto-fill')
  revalidatePath('/today')
  revalidatePath('/week')
  revalidatePath('/insights')
  return { ok: true, runId: run.id, inserted, skipped }
}

/** Deshace un run: borra sus entradas que sigan en auto_fill y marca el run reverted. */
export async function revertAutoFill(runId: string): Promise<ActionResult> {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false, error: 'Necesitas permisos de manager.' }
  }
  const orgId = person.organizationId

  const [run] = await db
    .select()
    .from(autoFillRuns)
    .where(and(eq(autoFillRuns.id, runId), eq(autoFillRuns.organizationId, orgId)))
    .limit(1)
  if (!run) return { ok: false, error: 'Run no encontrado.' }
  if (run.status === 'reverted') return { ok: false, error: 'Este run ya se deshizo.' }

  await db
    .delete(timeEntries)
    .where(and(eq(timeEntries.autoFillRunId, runId), eq(timeEntries.source, 'auto_fill')))

  await db.update(autoFillRuns).set({ status: 'reverted' }).where(eq(autoFillRuns.id, runId))

  await logAuditEvent({
    organizationId: orgId,
    actorId: person.id,
    action: 'time_entry.auto_fill_revert',
    entityType: 'auto_fill_run',
    entityId: runId,
    diff: { before: { status: run.status }, after: { status: 'reverted' } },
  })

  revalidatePath('/auto-fill')
  revalidatePath('/today')
  revalidatePath('/week')
  revalidatePath('/insights')
  return { ok: true }
}

/** Configura la dedicación de autorelleno de una asignación. */
export async function setAssignmentDedication(input: {
  assignmentId: string
  autoFillEnabled: boolean
  autoFillMode: AutoFillMode | null
  dedicationPercent: number | null
  monthlyTargetHours: number | null
  autoFillArea: string | null
}): Promise<ActionResult> {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return { ok: false, error: 'Necesitas permisos de manager.' }
  }
  const org = await getOrganizationContext()
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  // La asignación debe pertenecer a la org del manager.
  const [assignment] = await db
    .select({ id: projectAssignments.id, allowedAreas: projectAssignments.allowedAreas })
    .from(projectAssignments)
    .where(
      and(eq(projectAssignments.id, input.assignmentId), eq(projectAssignments.organizationId, org.id)),
    )
    .limit(1)
  if (!assignment) return { ok: false, error: 'Asignación no encontrada.' }

  // Validaciones si se habilita el autorelleno.
  if (input.autoFillEnabled) {
    if (!input.autoFillMode) return { ok: false, error: 'Elige un modo de dedicación.' }
    if (input.autoFillMode === 'percent') {
      if (input.dedicationPercent == null || input.dedicationPercent <= 0 || input.dedicationPercent > 100)
        return { ok: false, error: 'El porcentaje de dedicación debe estar entre 0 y 100.' }
    } else {
      if (input.monthlyTargetHours == null || input.monthlyTargetHours <= 0)
        return { ok: false, error: 'Las horas/mes deben ser mayores que 0.' }
    }
    if (input.autoFillArea && !assignment.allowedAreas.includes(input.autoFillArea))
      return { ok: false, error: 'El área elegida no está permitida en la asignación.' }
  }

  await db
    .update(projectAssignments)
    .set({
      autoFillEnabled: input.autoFillEnabled,
      autoFillMode: input.autoFillMode,
      dedicationPercent: input.dedicationPercent == null ? null : String(input.dedicationPercent),
      monthlyTargetHours: input.monthlyTargetHours == null ? null : String(input.monthlyTargetHours),
      autoFillArea: input.autoFillArea,
      updatedAt: new Date(),
    })
    .where(eq(projectAssignments.id, input.assignmentId))

  await logAuditEvent({
    organizationId: org.id,
    actorId: person.id,
    action: 'project_assignment.set_dedication',
    entityType: 'project_assignment',
    entityId: input.assignmentId,
    diff: { before: null, after: input },
  })

  revalidatePath('/auto-fill')
  return { ok: true }
}
