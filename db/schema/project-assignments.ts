import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { persons } from './persons'
import { projects } from './projects'

/** Modo de dedicación para el autorelleno de horas (F3.5). */
export const autoFillModeEnum = pgEnum('auto_fill_mode', ['percent', 'monthly_hours'])

export const projectAssignments = pgTable(
  'project_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id),
    allowedAreas: jsonb('allowed_areas').notNull().$type<string[]>(),
    isActive: boolean('is_active').notNull().default(true),
    // ─── Autorelleno de horas (F3.5) ────────────────────────────────────────────
    autoFillEnabled: boolean('auto_fill_enabled').notNull().default(false),
    autoFillMode: autoFillModeEnum('auto_fill_mode'),
    // Modo 'percent': 0–100 (% de la jornada dedicado a este proyecto).
    dedicationPercent: numeric('dedication_percent', { precision: 5, scale: 2 }),
    // Modo 'monthly_hours': horas objetivo al mes para esta persona en este proyecto.
    monthlyTargetHours: numeric('monthly_target_hours', { precision: 6, scale: 2 }),
    // Área a la que se imputa (debe ∈ allowedAreas). Si null → primaryArea de la persona.
    autoFillArea: text('auto_fill_area'),
    // Ventana de validez de la dedicación (altas/bajas, cambios de %).
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('project_assignments_org_id_idx').on(table.organizationId),
    uniqueIndex('project_assignments_unique_idx').on(table.projectId, table.personId),
    index('project_assignments_person_active_idx').on(table.personId, table.isActive),
  ],
)
