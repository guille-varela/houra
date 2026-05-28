import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),

    // Acuerdo Marco
    hasMarco: boolean('has_marco').notNull().default(false),
    marcoStartDate: date('marco_start_date'),
    marcoEndDate: date('marco_end_date'),
    // toggle: false = una tarifa global, true = tarifa por categoría
    marcoUsePerRoleRates: boolean('marco_use_per_role_rates').notNull().default(false),
    marcoGlobalRateCents: integer('marco_global_rate_cents'),
    // null en una categoría significa "hereda marcoGlobalRateCents"
    marcoRateByCategory: jsonb('marco_rate_by_category')
      .$type<Partial<Record<'head' | 'lead' | 'senior' | 'mid' | 'junior' | 'trainee', number | null>>>(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('clients_org_id_idx').on(table.organizationId)],
)
