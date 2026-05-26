import { and, eq, isNotNull } from 'drizzle-orm'
import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'
import { reports, reportSnapshots } from '@/db/schema'
import { buildProjectSnapshot, buildWorkspaceSnapshot } from '@/lib/report-data'

export const autoSnapshotReports = inngest.createFunction(
  {
    id: 'auto-snapshot-reports',
    triggers: [{ cron: 'TZ=Europe/Madrid 0 2 * * *' }],
  },
  async ({ step }) => {
    const openReports = await step.run('fetch-reports', () =>
      db
        .select({ id: reports.id, scope: reports.scope, scopeId: reports.scopeId })
        .from(reports)
        .where(and(eq(reports.status, 'open'), isNotNull(reports.autoSnapshotSchedule))),
    )

    const today = new Date().toISOString().slice(0, 10)

    for (const report of openReports) {
      await step.run(`snapshot-${report.id}`, async () => {
        const data =
          report.scope === 'project'
            ? await buildProjectSnapshot(report.scopeId)
            : await buildWorkspaceSnapshot(report.scopeId)

        await db.insert(reportSnapshots).values({
          reportId: report.id,
          frozenData: data,
          label: `auto:${today}`,
        })
      })
    }

    return { snapshotted: openReports.length }
  },
)
