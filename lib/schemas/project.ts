import { z } from 'zod'

export const PROJECT_STATUSES = ['draft', 'active', 'paused', 'closed'] as const

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['paused', 'closed'],
  paused: ['active', 'closed'],
  closed: [],
}

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export const updateProjectStatusSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(PROJECT_STATUSES),
})

export const upsertAssignmentSchema = z.object({
  projectId: z.string().uuid(),
  personId: z.string().uuid(),
  allowedAreas: z.array(z.string()).min(1, 'Al menos un área requerida'),
})

export const deactivateAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
})

export const updateAllocationSchema = z.object({
  projectId: z.string().uuid(),
  allocation: z.record(z.string(), z.record(z.string(), z.number().min(0))),
})
