import { z } from 'zod'

export const createTimeEntrySchema = z.object({
  projectId: z.string().uuid('ID de proyecto inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  hours: z.coerce
    .number()
    .min(0.5, 'Mínimo 0.5 horas')
    .max(24, 'No puede superar 24 horas'),
  area: z.string().min(1, 'Selecciona un área'),
  description: z.string().optional(),
})

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>
