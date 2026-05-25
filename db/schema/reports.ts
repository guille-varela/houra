import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'

export const reportScopeEnum = pgEnum('report_scope', [
  'project',
  'workspace',
  'organization',
  'person',
])
export const reportStatusEnum = pgEnum('report_status', ['open', 'closed'])

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    scope: reportScopeEnum('scope').notNull(),
    scopeId: uuid('scope_id').notNull(),
    filters: jsonb('filters'),
    shareUrlSlug: text('share_url_slug').notNull().unique(),
    passwordHash: text('password_hash'),
    status: reportStatusEnum('status').notNull().default('open'),
    autoSnapshotSchedule: jsonb('auto_snapshot_schedule'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => persons.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('reports_org_id_idx').on(table.organizationId),
    uniqueIndex('reports_slug_idx').on(table.shareUrlSlug),
  ],
)

export const reportSnapshots = pgTable('report_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => reports.id, { onDelete: 'cascade' }),
  frozenData: jsonb('frozen_data').notNull(),
  takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
  label: text('label').notNull(),
})
