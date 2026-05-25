import { date, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'
import { projects } from './projects'

export const amendments = pgTable(
  'amendments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    deltaAllocation: jsonb('delta_allocation')
      .notNull()
      .$type<Record<string, Record<string, number>>>(),
    deltaRates: jsonb('delta_rates').$type<Record<string, unknown>>(),
    reason: text('reason').notNull(),
    clientReference: text('client_reference'),
    effectiveDate: date('effective_date').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => persons.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('amendments_org_id_idx').on(table.organizationId),
    index('amendments_project_id_idx').on(table.projectId),
  ],
)
