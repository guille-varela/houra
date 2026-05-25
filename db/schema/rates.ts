import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'
import { projects } from './projects'
import { workspaces } from './workspaces'

export const rates = pgTable(
  'rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    projectId: uuid('project_id').references(() => projects.id),
    personId: uuid('person_id').references(() => persons.id),
    area: text('area').notNull(),
    role: text('role').notNull(),
    costRateCents: integer('cost_rate_cents'),
    soldRateCents: integer('sold_rate_cents'),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('rates_org_id_idx').on(table.organizationId),
    index('rates_lookup_idx').on(table.organizationId, table.area, table.role),
  ],
)
