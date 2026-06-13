'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { organizations } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'

export async function updateOrganizationSettings(data: {
  defaultTargetMarginPct?: number
  proposalExpiryDays?: number
}) {
  const person = await requireRole('admin')

  await db
    .update(organizations)
    .set({
      ...(data.defaultTargetMarginPct != null
        ? { defaultTargetMarginPct: data.defaultTargetMarginPct.toString() }
        : {}),
      ...(data.proposalExpiryDays != null ? { proposalExpiryDays: data.proposalExpiryDays } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, person.organizationId))

  await logAuditEvent({
    organizationId: person.organizationId,
    actorId: person.id,
    entityType: 'organization',
    entityId: person.organizationId,
    action: 'settings_updated',
    diff: { before: null, after: data },
  })

  revalidatePath('/settings/organization')
  return { ok: true as const }
}
