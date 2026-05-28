'use server'

import { eq, and, asc, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  proposals,
  proposalPhases,
  proposalStaffing,
  projects,
  projectAssignments,
} from '@/db/schema'
import { requireRole, getOrganizationContext } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { isValidProposalTransition } from '@/lib/schemas/proposal'
import type { ProposalStatus } from '@/lib/schemas/proposal'

export type { ProposalStatus }

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getProposals() {
  const person = await requireRole('manager')
  return db
    .select({
      id: proposals.id,
      name: proposals.name,
      status: proposals.status,
      billingModel: proposals.billingModel,
      targetMarginPercent: proposals.targetMarginPercent,
      clientId: proposals.clientId,
      convertedProjectId: proposals.convertedProjectId,
      createdAt: proposals.createdAt,
    })
    .from(proposals)
    .where(eq(proposals.organizationId, person.organizationId))
    .orderBy(desc(proposals.createdAt))
}

export async function getProposal(id: string) {
  const person = await requireRole('manager')
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, id), eq(proposals.organizationId, person.organizationId)))
    .limit(1)
  return proposal ?? null
}

export async function getProposalPhases(proposalId: string) {
  const person = await requireRole('manager')
  return db
    .select()
    .from(proposalPhases)
    .where(
      and(
        eq(proposalPhases.proposalId, proposalId),
        eq(proposalPhases.organizationId, person.organizationId),
      ),
    )
    .orderBy(asc(proposalPhases.sortOrder), asc(proposalPhases.createdAt))
}

export async function getProposalStaffing(proposalId: string) {
  const person = await requireRole('manager')
  return db
    .select()
    .from(proposalStaffing)
    .where(
      and(
        eq(proposalStaffing.proposalId, proposalId),
        eq(proposalStaffing.organizationId, person.organizationId),
      ),
    )
    .orderBy(asc(proposalStaffing.createdAt))
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function createProposal(data: {
  name: string
  clientId?: string | null
  projectType?: string
  billingModel?: string
  targetMarginPercent?: number | null
}) {
  const person = await requireRole('manager')

  const [proposal] = await db
    .insert(proposals)
    .values({
      organizationId: person.organizationId,
      name: data.name.trim(),
      clientId: data.clientId ?? null,
      projectType: data.projectType ?? 'fixed_bag',
      billingModel: data.billingModel ?? 'hour_bag',
      targetMarginPercent: data.targetMarginPercent?.toString() ?? null,
      createdBy: person.id,
    })
    .returning()

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'proposal',
    entityId: proposal!.id,
    action: 'created',
    diff: { before: null, after: { name: data.name } },
  })

  revalidatePath('/proposals')
  return { ok: true as const, id: proposal!.id }
}

export async function updateProposal(
  id: string,
  data: {
    name?: string
    clientId?: string | null
    projectType?: string
    billingModel?: string
    targetMarginPercent?: number | null
    internalNotes?: string | null
  },
) {
  const person = await requireRole('manager')

  await db
    .update(proposals)
    .set({
      ...data,
      name: data.name?.trim(),
      targetMarginPercent: data.targetMarginPercent?.toString() ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(proposals.id, id), eq(proposals.organizationId, person.organizationId)))

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'proposal',
    entityId: id,
    action: 'updated',
    diff: { before: null, after: data },
  })

  revalidatePath('/proposals')
  revalidatePath(`/proposals/${id}`)
  return { ok: true as const }
}

export async function updateProposalStatus(id: string, status: ProposalStatus) {
  const person = await requireRole('manager')

  const [proposal] = await db
    .select({ status: proposals.status })
    .from(proposals)
    .where(and(eq(proposals.id, id), eq(proposals.organizationId, person.organizationId)))
    .limit(1)

  if (!proposal) return { ok: false as const, error: 'Propuesta no encontrada.' }
  if (!isValidProposalTransition(proposal.status, status)) {
    return { ok: false as const, error: `No se puede pasar de ${proposal.status} a ${status}.` }
  }

  await db
    .update(proposals)
    .set({ status, updatedAt: new Date() })
    .where(eq(proposals.id, id))

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'proposal',
    entityId: id,
    action: 'status_changed',
    diff: { before: { status: proposal.status }, after: { status } },
  })

  revalidatePath('/proposals')
  revalidatePath(`/proposals/${id}`)
  return { ok: true as const }
}

// ─── Phases ─────────────────────────────────────────────────────────────────

export async function addProposalPhase(
  proposalId: string,
  data: { name: string; billingAmount?: number | null; deliveryDate?: string | null },
) {
  const person = await requireRole('manager')

  const existing = await getProposalPhases(proposalId)
  const sortOrder = existing.length

  const [phase] = await db
    .insert(proposalPhases)
    .values({
      organizationId: person.organizationId,
      proposalId,
      name: data.name.trim(),
      billingAmount: data.billingAmount?.toString() ?? null,
      deliveryDate: data.deliveryDate ?? null,
      sortOrder: sortOrder.toString(),
    })
    .returning()

  revalidatePath(`/proposals/${proposalId}`)
  return { ok: true as const, id: phase!.id }
}

export async function deleteProposalPhase(phaseId: string) {
  const person = await requireRole('manager')

  const [phase] = await db
    .select()
    .from(proposalPhases)
    .where(and(eq(proposalPhases.id, phaseId), eq(proposalPhases.organizationId, person.organizationId)))
    .limit(1)

  if (!phase) return { ok: false as const, error: 'Fase no encontrada.' }

  await db.delete(proposalPhases).where(eq(proposalPhases.id, phaseId))
  revalidatePath(`/proposals/${phase.proposalId}`)
  return { ok: true as const }
}

// ─── Staffing ────────────────────────────────────────────────────────────────

export async function addStaffingLine(
  proposalId: string,
  data: {
    phaseId?: string | null
    staffingType: 'person' | 'role'
    personId?: string | null
    roleCategory?: string | null
    area: string
    estimatedHours: number
  },
) {
  const person = await requireRole('manager')

  const [line] = await db
    .insert(proposalStaffing)
    .values({
      organizationId: person.organizationId,
      proposalId,
      phaseId: data.phaseId ?? null,
      staffingType: data.staffingType,
      personId: data.personId ?? null,
      roleCategory: data.roleCategory ?? null,
      area: data.area,
      estimatedHours: data.estimatedHours.toString(),
    })
    .returning()

  revalidatePath(`/proposals/${proposalId}`)
  return { ok: true as const, id: line!.id }
}

export async function deleteStaffingLine(lineId: string) {
  const person = await requireRole('manager')

  const [line] = await db
    .select()
    .from(proposalStaffing)
    .where(and(eq(proposalStaffing.id, lineId), eq(proposalStaffing.organizationId, person.organizationId)))
    .limit(1)

  if (!line) return { ok: false as const, error: 'Línea no encontrada.' }

  await db.delete(proposalStaffing).where(eq(proposalStaffing.id, lineId))
  revalidatePath(`/proposals/${line.proposalId}`)
  return { ok: true as const }
}

// ─── Duplicate ───────────────────────────────────────────────────────────────

export async function duplicateProposal(id: string) {
  const person = await requireRole('manager')

  const original = await getProposal(id)
  if (!original) return { ok: false as const, error: 'Propuesta no encontrada.' }

  const phases = await getProposalPhases(id)
  const staffing = await getProposalStaffing(id)

  const [newProposal] = await db
    .insert(proposals)
    .values({
      organizationId: person.organizationId,
      clientId: original.clientId,
      name: `${original.name} (copia)`,
      status: 'draft',
      projectType: original.projectType,
      billingModel: original.billingModel,
      targetMarginPercent: original.targetMarginPercent,
      internalNotes: original.internalNotes,
      createdBy: person.id,
    })
    .returning()

  // Duplicate phases and remap staffing IDs
  const phaseIdMap = new Map<string, string>()
  for (const phase of phases) {
    const [newPhase] = await db
      .insert(proposalPhases)
      .values({
        organizationId: person.organizationId,
        proposalId: newProposal!.id,
        name: phase.name,
        billingAmount: phase.billingAmount,
        deliveryDate: phase.deliveryDate,
        sortOrder: phase.sortOrder,
      })
      .returning()
    phaseIdMap.set(phase.id, newPhase!.id)
  }

  for (const line of staffing) {
    await db.insert(proposalStaffing).values({
      organizationId: person.organizationId,
      proposalId: newProposal!.id,
      phaseId: line.phaseId ? (phaseIdMap.get(line.phaseId) ?? null) : null,
      staffingType: line.staffingType,
      personId: line.personId,
      roleCategory: line.roleCategory,
      area: line.area,
      estimatedHours: line.estimatedHours,
    })
  }

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'proposal',
    entityId: newProposal!.id,
    action: 'duplicated',
    diff: { before: null, after: { sourceId: id, name: newProposal!.name } },
  })

  revalidatePath('/proposals')
  return { ok: true as const, id: newProposal!.id }
}

// ─── Convert to project ──────────────────────────────────────────────────────

export async function convertProposalToProject(proposalId: string) {
  const person = await requireRole('admin')
  const org = await getOrganizationContext()
  if (!org) return { ok: false as const, error: 'Organización no encontrada.' }

  const proposal = await getProposal(proposalId)
  if (!proposal) return { ok: false as const, error: 'Propuesta no encontrada.' }
  if (proposal.status !== 'approved') {
    return { ok: false as const, error: 'Solo se pueden convertir propuestas aprobadas.' }
  }
  if (proposal.convertedProjectId) {
    return { ok: false as const, error: 'Esta propuesta ya fue convertida en proyecto.' }
  }

  const phases = await getProposalPhases(proposalId)
  const staffing = await getProposalStaffing(proposalId)

  // Build empty allocation matrix from staffing
  const allocation: Record<string, Record<string, number>> = {}
  for (const line of staffing) {
    if (!allocation[line.area]) allocation[line.area] = {}
    const key = line.staffingType === 'role' ? (line.roleCategory ?? 'mid') : 'mid'
    allocation[line.area]![key] = (allocation[line.area]![key] ?? 0) + Number(line.estimatedHours)
  }

  // Determine areas enabled from staffing
  const areasEnabled = [...new Set(staffing.map((s) => s.area))]

  // Find a workspace — use first active one for now
  const { workspaces } = await import('@/db/schema')
  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.organizationId, org.id))
    .limit(1)

  if (!workspace) return { ok: false as const, error: 'No hay workspace disponible.' }

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      workspaceId: workspace.id,
      clientId: proposal.clientId,
      name: proposal.name,
      type: proposal.projectType as 'fixed_bag' | 'renewable_bag' | 'ongoing_capacity',
      billingModel: proposal.billingModel as 'hour_bag' | 'monthly_fee' | 'by_phase',
      areasEnabled: areasEnabled.length ? areasEnabled : ['ux'],
      originalAllocation: Object.keys(allocation).length ? allocation : {},
      targetMarginPercent: proposal.targetMarginPercent,
      status: 'draft',
    })
    .returning()

  // Create project phases from proposal phases
  const { projectPhases } = await import('@/db/schema')
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!
    await db.insert(projectPhases).values({
      organizationId: org.id,
      projectId: project!.id,
      name: phase.name,
      estimatedHours: null,
      billingAmount: phase.billingAmount,
      deliveryDate: phase.deliveryDate,
      sortOrder: i,
    })
  }

  // Create assignments for person-based staffing lines
  const { projectAssignments } = await import('@/db/schema')
  const assignedPersonIds = new Set<string>()
  for (const line of staffing.filter((s) => s.staffingType === 'person' && s.personId)) {
    if (!assignedPersonIds.has(line.personId!)) {
      assignedPersonIds.add(line.personId!)
      await db.insert(projectAssignments).values({
        organizationId: org.id,
        projectId: project!.id,
        personId: line.personId!,
        allowedAreas: areasEnabled,
        isActive: true,
      })
    }
  }

  // Link proposal → project
  await db
    .update(proposals)
    .set({ convertedProjectId: project!.id, updatedAt: new Date() })
    .where(eq(proposals.id, proposalId))

  await logAuditEvent({
    organizationId: org.id,
    actorId: person.id,
    entityType: 'proposal',
    entityId: proposalId,
    action: 'converted_to_project',
    diff: { before: { status: 'approved' }, after: { projectId: project!.id } },
  })

  revalidatePath('/proposals')
  revalidatePath(`/proposals/${proposalId}`)
  revalidatePath('/projects')
  return { ok: true as const, projectId: project!.id }
}
