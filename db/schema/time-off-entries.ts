import { date, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'

export const timeOffTypeEnum = pgEnum('time_off_type', ['holiday', 'vacation', 'sick_leave'])

export const timeOffEntries = pgTable(
  'time_off_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id),
    date: date('date').notNull(),
    type: timeOffTypeEnum('type').notNull(),
    hours: numeric('hours', { precision: 5, scale: 2 }),
    note: text('note'),
    externalSource: text('external_source'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('time_off_entries_org_id_idx').on(table.organizationId),
    index('time_off_entries_person_date_idx').on(table.personId, table.date),
  ],
)
