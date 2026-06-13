export type ProposalStatus =
  | 'draft'
  | 'internal_review'
  | 'pending_approval'
  | 'approved'
  | 'paused'
  | 'expired'

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  'draft',
  'internal_review',
  'pending_approval',
  'approved',
  'paused',
  'expired',
]

const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft:            ['internal_review', 'pending_approval', 'approved', 'paused'],
  internal_review:  ['draft', 'pending_approval', 'approved', 'paused'],
  pending_approval: ['internal_review', 'draft', 'approved', 'paused', 'expired'],
  approved:         [],
  paused:           ['draft', 'internal_review', 'pending_approval'],
  expired:          ['draft', 'pending_approval'],
}

export function isValidProposalTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from as ProposalStatus] ?? []).includes(to as ProposalStatus)
}
