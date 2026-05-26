import { z } from 'zod'

export const createTimeOffEntrySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['holiday', 'vacation', 'sick_leave']),
  hoursPerDay: z.number().min(0.5).max(24).default(8),
  note: z.string().max(200).optional(),
})

export const deleteTimeOffEntrySchema = z.object({
  id: z.string().uuid(),
})
