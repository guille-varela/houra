import { integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const holidayPresets = pgTable(
  'holiday_presets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    region: text('region').notNull(),
    year: integer('year').notNull(),
    dates: jsonb('dates').notNull().$type<Array<{ date: string; name: string }>>(),
  },
  (table) => [uniqueIndex('holiday_presets_region_year_idx').on(table.region, table.year)],
)
