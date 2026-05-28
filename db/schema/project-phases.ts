import { date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { projects } from './projects'

export const projectPhaseStatusEnum = pgEnum('project_phase_status', [
  'planned',
  'in_progress',
  'delivered',
  'invoiced',
])

export const projectPhases = pgTable(
  'project_phases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    estimatedHours: numeric('estimated_hours', { precision: 8, scale: 2 }),
    // Solo relevante cuando billingModel = 'by_phase'
    billingAmount: numeric('billing_amount', { precision: 12, scale: 2 }),
    deliveryDate: date('delivery_date'),
    status: projectPhaseStatusEnum('status').notNull().default('planned'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('project_phases_project_id_idx').on(table.projectId),
    index('project_phases_org_id_idx').on(table.organizationId),
  ],
)
