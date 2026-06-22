import { date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'
import { projects } from './projects'
import { autoFillRuns } from './auto-fill-runs'

/** Origen de la entrada: imputada a mano o generada por autorelleno. */
export const timeEntrySourceEnum = pgEnum('time_entry_source', ['manual', 'auto_fill'])

export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    date: date('date').notNull(),
    hours: numeric('hours', { precision: 8, scale: 2 }).notNull(),
    area: text('area').notNull(),
    description: text('description'),
    checklist: jsonb('checklist').$type<Array<{ label: string; done: boolean }>>(),
    costRateAtEntryCents: integer('cost_rate_at_entry_cents').notNull(),
    soldRateAtEntryCents: integer('sold_rate_at_entry_cents').notNull(),
    // Origen de la entrada (manual por defecto → migración deja el histórico como manual).
    source: timeEntrySourceEnum('source').notNull().default('manual'),
    // Lote de autorelleno que la generó (permite reconciliar y "deshacer un run").
    autoFillRunId: uuid('auto_fill_run_id').references(() => autoFillRuns.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('time_entries_org_id_idx').on(table.organizationId),
    index('time_entries_person_date_idx').on(table.personId, table.date),
    index('time_entries_project_id_idx').on(table.projectId),
    index('time_entries_project_area_idx').on(table.projectId, table.area),
    // Reconciliación del autorelleno: localizar entradas auto de una persona×proyecto×día.
    index('time_entries_autofill_idx').on(
      table.personId,
      table.projectId,
      table.date,
      table.source,
    ),
  ],
)
