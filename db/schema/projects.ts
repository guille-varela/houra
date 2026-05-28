import {
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { departments, organizations } from './organizations'
import { workspaces } from './workspaces'
import { clients } from './clients'

export const projectTypeEnum = pgEnum('project_type', [
  'fixed_bag',
  'renewable_bag',
  'ongoing_capacity',
])
export const projectStatusEnum = pgEnum('project_status', [
  'draft',
  'active',
  'paused',
  'closed',
])
export const contributorDashboardAccessEnum = pgEnum('contributor_dashboard_access', [
  'none',
  'assigned_only',
  'all',
])
export const billingModelEnum = pgEnum('billing_model', [
  'hour_bag',
  'monthly_fee',
  'by_phase',
])

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    // Cliente al que pertenece el proyecto (null = proyecto interno)
    clientId: uuid('client_id').references(() => clients.id),
    name: text('name').notNull(),
    type: projectTypeEnum('type').notNull(),
    // Cómo se factura al cliente (ortogonal al tipo de bolsa)
    billingModel: billingModelEnum('billing_model').notNull().default('hour_bag'),
    areasEnabled: jsonb('areas_enabled').notNull().$type<string[]>(),
    originalAllocation: jsonb('original_allocation')
      .notNull()
      .$type<Record<string, Record<string, number>>>(),
    weeklyHours: numeric('weekly_hours', { precision: 5, scale: 2 })
      .notNull()
      .default('37.5'),
    status: projectStatusEnum('status').notNull().default('draft'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    // Margen objetivo en % (ej: 30 = 30%)
    targetMarginPercent: numeric('target_margin_percent', { precision: 5, scale: 2 }),
    // Porcentaje de consumo de bolsa a partir del cual se dispara alerta (default 80)
    hourBagAlertThreshold: numeric('hour_bag_alert_threshold', { precision: 5, scale: 2 })
      .notNull()
      .default('80'),
    notificationSettings: jsonb('notification_settings'),
    contributorDashboardAccess: contributorDashboardAccessEnum(
      'contributor_dashboard_access',
    )
      .notNull()
      .default('assigned_only'),
    timezoneOverride: text('timezone_override'),
    departmentId: uuid('department_id').references(() => departments.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('projects_org_id_idx').on(table.organizationId),
    index('projects_workspace_id_idx').on(table.workspaceId),
    index('projects_client_id_idx').on(table.clientId),
  ],
)
