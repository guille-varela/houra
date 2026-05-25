import { jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const renewalBehaviorEnum = pgEnum('renewal_behavior', ['reset', 'carry_over'])

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  currency: text('currency').notNull().default('EUR'),
  timezone: text('timezone').notNull().default('Europe/Madrid'),
  defaultWeeklyHours: numeric('default_weekly_hours', { precision: 5, scale: 2 })
    .notNull()
    .default('37.5'),
  dailyHoursSoftCap: numeric('daily_hours_soft_cap', { precision: 5, scale: 2 })
    .notNull()
    .default('14'),
  defaultRenewalBehavior: renewalBehaviorEnum('default_renewal_behavior')
    .notNull()
    .default('reset'),
  defaultNotificationChannels: jsonb('default_notification_channels'),
  digestSchedule: jsonb('digest_schedule'),
  reportDefaultPasswordHash: text('report_default_password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
