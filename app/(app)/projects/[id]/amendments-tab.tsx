import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { amendments, persons } from '@/db/schema'
import { computeEffectiveAllocation } from '@/lib/margin'
import { type Allocation } from '@/lib/matrix'
import AmendmentsTabClient from './amendments-tab-client'

type Props = {
  projectId: string
  originalAllocation: Allocation
  projectStatus: string
}

export default async function AmendmentsTab({ projectId, originalAllocation, projectStatus }: Props) {
  const rows = await db
    .select({
      id: amendments.id,
      effectiveDate: amendments.effectiveDate,
      reason: amendments.reason,
      clientReference: amendments.clientReference,
      createdAt: amendments.createdAt,
      deltaAllocation: amendments.deltaAllocation,
      createdByName: persons.name,
    })
    .from(amendments)
    .innerJoin(persons, eq(persons.id, amendments.createdBy))
    .where(eq(amendments.projectId, projectId))
    .orderBy(desc(amendments.effectiveDate))

  const effectiveAllocation = computeEffectiveAllocation(
    originalAllocation,
    rows as Array<{ deltaAllocation: Record<string, Record<string, number>> }>,
  )

  const canCreate = ['active', 'paused'].includes(projectStatus)

  return (
    <AmendmentsTabClient
      projectId={projectId}
      amendments={rows.map((r) => ({
        id: r.id,
        effectiveDate: r.effectiveDate,
        reason: r.reason,
        clientReference: r.clientReference,
        createdByName: r.createdByName ?? 'Desconocido',
        createdAt: r.createdAt.toISOString(),
        deltaAllocation: r.deltaAllocation as Record<string, Record<string, number>>,
      }))}
      effectiveAllocation={effectiveAllocation}
      canCreate={canCreate}
    />
  )
}
