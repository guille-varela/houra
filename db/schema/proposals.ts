import {
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { clients } from './clients'
import { persons } from './persons'
import { projects } from './projects'

export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft',
  'internal_review',
  'pending_approval',
  'approved',
])

export const proposalStaffingTypeEnum = pgEnum('proposal_staffing_type', [
  'person',
  'role',
])

export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id),
    name: text('name').notNull(),
    status: proposalStatusEnum('status').notNull().default('draft'),
    // Tipo de bolsa (mismo enum que projects)
    projectType: text('project_type').notNull().default('fixed_bag'),
    billingModel: text('billing_model').notNull().default('hour_bag'),
    targetMarginPercent: numeric('target_margin_percent', { precision: 5, scale: 2 }),
    internalNotes: text('internal_notes'),
    // Referencia al proyecto creado al convertir la propuesta aprobada
    convertedProjectId: uuid('converted_project_id').references(() => projects.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => persons.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('proposals_org_id_idx').on(table.organizationId),
    index('proposals_client_id_idx').on(table.clientId),
    index('proposals_status_idx').on(table.status),
  ],
)

export const proposalPhases = pgTable(
  'proposal_phases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    deliveryDate: date('delivery_date'),
    // Para billingModel = 'by_phase'
    billingAmount: numeric('billing_amount', { precision: 12, scale: 2 }),
    sortOrder: numeric('sort_order').notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('proposal_phases_proposal_id_idx').on(table.proposalId),
  ],
)

export const proposalStaffing = pgTable(
  'proposal_staffing',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    phaseId: uuid('phase_id').references(() => proposalPhases.id, { onDelete: 'cascade' }),
    // Tipo: perfil genérico o persona concreta
    staffingType: proposalStaffingTypeEnum('staffing_type').notNull().default('role'),
    personId: uuid('person_id').references(() => persons.id),
    // Categoría de billing cuando staffingType = 'role'
    roleCategory: text('role_category'),
    area: text('area').notNull(),
    estimatedHours: numeric('estimated_hours', { precision: 8, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('proposal_staffing_proposal_id_idx').on(table.proposalId),
    index('proposal_staffing_phase_id_idx').on(table.phaseId),
  ],
)
