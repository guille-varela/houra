import { eq } from 'drizzle-orm'
import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'
import { proposals, organizations, persons } from '@/db/schema'
import { logAuditEvent } from '@/lib/audit'
import { notifySlack } from '@/lib/notify'

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * F2.15 — Job nocturno de caducidad de propuestas.
 * Marca como `expired` las propuestas en `pending_approval` que llevan más de
 * `organization.proposal_expiry_days` sin actualizarse, y avisa al creador
 * 7 días antes (una sola vez, vía `expiry_notified_at`).
 */
export const expireProposals = inngest.createFunction(
  {
    id: 'expire-proposals',
    triggers: [{ cron: 'TZ=Europe/Madrid 0 3 * * *' }],
  },
  async ({ step }) => {
    const rows = await step.run('fetch-pending', () =>
      db
        .select({
          id: proposals.id,
          name: proposals.name,
          organizationId: proposals.organizationId,
          updatedAt: proposals.updatedAt,
          expiryNotifiedAt: proposals.expiryNotifiedAt,
          creatorName: persons.name,
          expiryDays: organizations.proposalExpiryDays,
        })
        .from(proposals)
        .innerJoin(organizations, eq(organizations.id, proposals.organizationId))
        .leftJoin(persons, eq(persons.id, proposals.createdBy))
        .where(eq(proposals.status, 'pending_approval')),
    )

    const now = Date.now()
    let expired = 0
    let notified = 0

    for (const r of rows) {
      const daysSinceUpdate = (now - new Date(r.updatedAt).getTime()) / MS_PER_DAY

      if (daysSinceUpdate >= r.expiryDays) {
        await step.run(`expire-${r.id}`, async () => {
          await db
            .update(proposals)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(eq(proposals.id, r.id))
          await logAuditEvent({
            organizationId: r.organizationId,
            actorId: null,
            entityType: 'proposal',
            entityId: r.id,
            action: 'expired',
            diff: { before: { status: 'pending_approval' }, after: { status: 'expired' } },
            metadata: { reason: `Sin actualizar ${Math.floor(daysSinceUpdate)} días (límite ${r.expiryDays})` },
          })
        })
        expired++
      } else if (daysSinceUpdate >= r.expiryDays - 7 && !r.expiryNotifiedAt) {
        await step.run(`notify-${r.id}`, async () => {
          await notifySlack(
            `⏳ La propuesta "${r.name}"${r.creatorName ? ` de ${r.creatorName}` : ''} caducará en 7 días si no se actualiza.`,
          )
          await db
            .update(proposals)
            .set({ expiryNotifiedAt: new Date() })
            .where(eq(proposals.id, r.id))
        })
        notified++
      }
    }

    return { scanned: rows.length, expired, notified }
  },
)
