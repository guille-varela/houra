import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reports } from '@/db/schema'
import ShareTabClient from './share-tab-client'

type Props = { projectId: string }

export default async function ShareTab({ projectId }: Props) {
  const rows = await db
    .select({
      id: reports.id,
      shareUrlSlug: reports.shareUrlSlug,
      status: reports.status,
      passwordHash: reports.passwordHash,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.scopeId, projectId))
    .orderBy(desc(reports.createdAt))

  return (
    <ShareTabClient
      projectId={projectId}
      reports={rows.map((r) => ({
        id: r.id,
        shareUrlSlug: r.shareUrlSlug,
        status: r.status,
        hasPassword: r.passwordHash !== null,
        createdAt: r.createdAt.toISOString(),
      }))}
    />
  )
}
