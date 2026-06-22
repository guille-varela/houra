import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { departments, organizations } from './organizations'

export const appRoleEnum = pgEnum('app_role', ['admin', 'manager', 'contributor'])
export const professionalCategoryEnum = pgEnum('professional_category', [
  'trainee',
  'junior',
  'mid',
  'senior',
  'lead',
  'head',
])
export const areaEnum = pgEnum('area', ['research', 'ux', 'ui', 'cro'])

/** Origen del avatar mostrado. Cascada de resolución: upload > google > generated > initials. */
export const avatarTypeEnum = pgEnum('avatar_type', ['initials', 'generated', 'upload', 'google'])

export const persons = pgTable(
  'persons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    appRole: appRoleEnum('app_role').notNull().default('contributor'),
    professionalCategory: professionalCategoryEnum('professional_category').notNull(),
    primaryArea: areaEnum('primary_area').notNull(),
    holidayRegion: text('holiday_region'),
    // ─── Avatar (provisional: iniciales/generado; futuro: upload R2 / foto Google) ──
    avatarType: avatarTypeEnum('avatar_type').notNull().default('initials'),
    avatarUrl: text('avatar_url'), // upload (R2) o foto de Google
    avatarSeed: text('avatar_seed'), // semilla para boring-avatars (default = id)
    avatarVariant: text('avatar_variant'), // estilo boring-avatars: marble/beam/...
    avatarColor: text('avatar_color'), // override de color de las iniciales
    timezoneOverride: text('timezone_override'),
    notificationPreferences: jsonb('notification_preferences'),
    // Nivel interno informativo (no afecta a precio). UI: tooltip on hover.
    internalLevel: text('internal_level').$type<'level_1' | 'level_2' | 'level_3' | null>(),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
    departmentId: uuid('department_id').references(() => departments.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('persons_org_id_idx').on(table.organizationId)],
)
