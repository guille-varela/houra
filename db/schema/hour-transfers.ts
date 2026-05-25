import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'
import { projects } from './projects'

export const hourTransfers = pgTable(
  'hour_transfers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    fromProjectId: uuid('from_project_id')
      .notNull()
      .references(() => projects.id),
    toProjectId: uuid('to_project_id')
      .notNull()
      .references(() => projects.id),
    area: text('area').notNull(),
    role: text('role').notNull(),
    hours: numeric('hours', { precision: 8, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    performedBy: uuid('performed_by')
      .notNull()
      .references(() => persons.id),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('hour_transfers_org_id_idx').on(table.organizationId)],
)
