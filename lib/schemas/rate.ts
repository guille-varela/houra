import { z } from 'zod'

export const upsertRateSchema = z.object({
  id: z.string().uuid().optional(),
  area: z.string().min(1),
  role: z.string().min(1),
  costRateCents: z.number().int().min(0).nullable(),
  soldRateCents: z.number().int().min(0).nullable(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export const deleteRateSchema = z.object({
  id: z.string().uuid(),
})

export type UpsertRateInput = z.infer<typeof upsertRateSchema>
