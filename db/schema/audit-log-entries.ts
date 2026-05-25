import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'

export const auditLogEntries = pgTable(
  'audit_log_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    actorId: uuid('actor_id').references(() => persons.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    diff: jsonb('diff').notNull().$type<{ before: unknown; after: unknown }>(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_entries_org_id_idx').on(table.organizationId),
    index('audit_log_entries_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_entries_actor_id_idx').on(table.actorId),
  ],
)
