import { z } from 'zod'

export const createAmendmentSchema = z.object({
  projectId: z.string().uuid(),
  deltaAllocation: z.record(z.string(), z.record(z.string(), z.number())),
  reason: z.string().min(1, 'El motivo es obligatorio'),
  clientReference: z.string().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
})

export type CreateAmendmentInput = z.infer<typeof createAmendmentSchema>
