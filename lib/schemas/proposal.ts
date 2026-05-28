export type ProposalStatus = 'draft' | 'internal_review' | 'pending_approval' | 'approved'

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  'draft',
  'internal_review',
  'pending_approval',
  'approved',
]

const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft:            ['internal_review', 'pending_approval', 'approved'],
  internal_review:  ['draft', 'pending_approval', 'approved'],
  pending_approval: ['internal_review', 'draft', 'approved'],
  approved:         [],
}

export function isValidProposalTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from as ProposalStatus] ?? []).includes(to as ProposalStatus)
}
