import { z } from 'zod'

export const createReportSchema = z.object({
  scope: z.enum(['project', 'workspace']),
  scopeId: z.string().uuid(),
  password: z.string().min(4, 'Mínimo 4 caracteres').optional(),
})

export const verifyReportPasswordSchema = z.object({
  slug: z.string().min(1),
  password: z.string().min(1),
})

export type CreateReportInput = z.infer<typeof createReportSchema>
