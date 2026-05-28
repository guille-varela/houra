import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { db } from './db'
import { projects, rates } from '@/db/schema'

export async function resolveRate(
  personId: string,
  projectId: string,
  area: string,
  role: string,
  date: string,
): Promise<{ costRateCents: number; soldRateCents: number }> {
  const [project] = await db
    .select({ workspaceId: projects.workspaceId, organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) throw new Error('Proyecto no encontrado.')

  const { workspaceId, organizationId } = project

  const candidates = await db
    .select()
    .from(rates)
    .where(
      and(
        eq(rates.organizationId, organizationId),
        eq(rates.area, area),
        eq(rates.role, role),
        lte(rates.effectiveFrom, date),
        or(isNull(rates.effectiveTo), gte(rates.effectiveTo, date)),
      ),
    )

  const personRow = candidates.find((r) => r.personId === personId)
  const projectRow = candidates.find(
    (r) => r.projectId === projectId && r.personId === null,
  )
  const workspaceRow = candidates.find(
    (r) => r.workspaceId === workspaceId && r.projectId === null && r.personId === null,
  )
  const orgRow = candidates.find(
    (r) => r.workspaceId === null && r.projectId === null && r.personId === null,
  )

  // Cost: Person > Project > Workspace > Org
  const costRateCents =
    personRow?.costRateCents ??
    projectRow?.costRateCents ??
    workspaceRow?.costRateCents ??
    orgRow?.costRateCents ??
    null

  // Sold: Project > Workspace > Org (Person scope never carries sold)
  const soldRateCents =
    projectRow?.soldRateCents ??
    workspaceRow?.soldRateCents ??
    orgRow?.soldRateCents ??
    null

  if (costRateCents === null || soldRateCents === null) {
    throw new Error(
      `No hay tarifa configurada para el área ${area} y rol ${role}. Pide al admin que añada tarifas base para la organización.`,
    )
  }

  return { costRateCents, soldRateCents }
}
