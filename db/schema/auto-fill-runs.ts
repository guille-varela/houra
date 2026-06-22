import { date, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'

/**
 * F3.5 — Autorellenar horas (auto-fill).
 *
 * Cada ejecución de autorelleno (preview o confirmada) queda registrada aquí para
 * dar idempotencia por `runId`, histórico y la acción "deshacer este autorelleno".
 * Un run pasa de `preview` → `committed` al confirmar, o a `reverted` al deshacerse.
 */
export const autoFillRunStatusEnum = pgEnum('auto_fill_run_status', [
  'preview',
  'committed',
  'reverted',
])

export const autoFillRuns = pgTable(
  'auto_fill_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    // Quién lo lanzó; null = job programado (Inngest).
    triggeredBy: uuid('triggered_by').references(() => persons.id),
    triggerType: text('trigger_type').notNull(), // 'manual' | 'scheduled'
    status: autoFillRunStatusEnum('status').notNull().default('preview'),
    // Resumen del run: personas, entradas, horas totales, avisos…
    summary: jsonb('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('auto_fill_runs_org_id_idx').on(table.organizationId),
    index('auto_fill_runs_period_idx').on(table.periodStart, table.periodEnd),
  ],
)
