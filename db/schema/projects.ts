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
    name: text('name').notNull(),
    type: projectTypeEnum('type').notNull(),
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
  ],
)
