import { bigint, date, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid, index } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'
import { projects } from './projects'

/**
 * F3.5 — Rollup mensual para Insights (ver ADR-0011).
 *
 * Tabla materializada a grano `(organization, month, project, person, area)` con
 * las medidas pre-agregadas. La reconstruye el cron `refresh-insights`. El read
 * layer (`lib/insights-data.ts`) lee de aquí los meses pasados y calcula el mes en
 * curso en vivo desde `time_entries`, uniéndolos.
 *
 * `month` es el primer día del mes (date_trunc('month', ...)::date).
 * Categoría profesional, cliente, status y tipo NO se materializan: se resuelven
 * por join a `persons`/`projects` en lectura (dimensiones slowly-changing).
 */
export const insightsMonthly = pgTable(
  'insights_monthly',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    month: date('month').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id),
    area: text('area').notNull(),
    hours: numeric('hours', { precision: 12, scale: 2 }).notNull(),
    revenueCents: bigint('revenue_cents', { mode: 'number' }).notNull(),
    costCents: bigint('cost_cents', { mode: 'number' }).notNull(),
    entryCount: integer('entry_count').notNull(),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('insights_monthly_grain_idx').on(
      table.organizationId,
      table.month,
      table.projectId,
      table.personId,
      table.area,
    ),
    index('insights_monthly_org_month_idx').on(table.organizationId, table.month),
    index('insights_monthly_project_idx').on(table.projectId),
    index('insights_monthly_person_idx').on(table.personId),
  ],
)
