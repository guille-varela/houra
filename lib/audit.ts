import { db } from './db'
import { auditLogEntries } from '@/db/schema'

export async function logAuditEvent({
  organizationId,
  actorId,
  action,
  entityType,
  entityId,
  diff,
  metadata,
}: {
  organizationId: string
  actorId: string | null
  action: string
  entityType: string
  entityId: string
  diff: { before: unknown; after: unknown }
  metadata?: Record<string, unknown>
}) {
  await db.insert(auditLogEntries).values({
    organizationId,
    actorId: actorId ?? null,
    action,
    entityType,
    entityId,
    diff,
    metadata: metadata ?? null,
  })
}
