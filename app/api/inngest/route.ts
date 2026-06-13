import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { autoSnapshotReports, expireProposals } from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [autoSnapshotReports, expireProposals],
})
