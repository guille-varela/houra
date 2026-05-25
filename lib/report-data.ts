import { eq, sql } from 'drizzle-orm'
import { db } from './db'
import { amendments, persons, projects, timeEntries, workspaces } from '@/db/schema'
import {
  buildMatrix,
  getProjectTotals,
  AREAS,
  ROLES,
  type Area,
  type Role,
  type ConsumedMap,
  type Allocation,
} from './matrix'
import {
  buildMarginMatrix,
  computeEffectiveAllocation,
  getMarginTotals,
} from './margin'

export type ProjectSnapshotData = {
  type: 'project'
  project: {
    id: string
    name: string
    type: string
    status: string
    startDate: string | null
    endDate: string | null
    workspaceName: string | null
  }
  totals: { planned: number; consumed: number; pct: number | null; color: string }
  burnData: Array<{ week: string; hours: number; cumulative: number }>
  contributors: Array<{ name: string; hours: number }>
  marginTotals: { hours: number; costCents: number; soldCents: number; marginCents: number; marginPct: number | null }
  amendmentCount: number
  generatedAt: string
}

export type WorkspaceSnapshotData = {
  type: 'workspace'
  workspace: { id: string; name: string }
  projects: Array<{
    id: string
    name: string
    type: string
    status: string
    totals: { planned: number; consumed: number; pct: number | null; color: string }
    marginTotals: { hours: number; costCents: number; soldCents: number; marginCents: number; marginPct: number | null }
  }>
  generatedAt: string
}

export type ReportSnapshotData = ProjectSnapshotData | WorkspaceSnapshotData

export async function buildProjectSnapshot(projectId: string): Promise<ProjectSnapshotData> {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      startDate: projects.startDate,
      endDate: projects.endDate,
      originalAllocation: projects.originalAllocation,
      workspaceName: workspaces.name,
    })
    .from(projects)
    .leftJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) throw new Error(`Project ${projectId} not found`)

  const allocation = project.originalAllocation as Allocation

  const [consumedRows, amendmentRows, weekRows, contributorRows, marginRows] = await Promise.all([
    db
      .select({
        area: timeEntries.area,
        role: persons.professionalCategory,
        hours: sql<string>`SUM(${timeEntries.hours})`,
      })
      .from(timeEntries)
      .innerJoin(persons, eq(persons.id, timeEntries.personId))
      .where(eq(timeEntries.projectId, projectId))
      .groupBy(timeEntries.area, persons.professionalCategory),
    db
      .select({ deltaAllocation: amendments.deltaAllocation })
      .from(amendments)
      .where(eq(amendments.projectId, projectId)),
    db
      .select({
        week: sql<string>`TO_CHAR(DATE_TRUNC('week', ${timeEntries.date}::date), 'YYYY-MM-DD')`,
        hours: sql<string>`SUM(${timeEntries.hours})`,
      })
      .from(timeEntries)
      .where(eq(timeEntries.projectId, projectId))
      .groupBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`)
      .orderBy(sql`DATE_TRUNC('week', ${timeEntries.date}::date)`),
    db
      .select({
        name: persons.name,
        hours: sql<string>`SUM(${timeEntries.hours})`,
      })
      .from(timeEntries)
      .innerJoin(persons, eq(persons.id, timeEntries.personId))
      .where(eq(timeEntries.projectId, projectId))
      .groupBy(persons.name)
      .orderBy(sql`SUM(${timeEntries.hours}) DESC`)
      .limit(5),
    db
      .select({
        area: timeEntries.area,
        role: persons.professionalCategory,
        hours: sql<string>`SUM(${timeEntries.hours}::numeric)`,
        costCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.costRateAtEntryCents})`,
        soldCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.soldRateAtEntryCents})`,
      })
      .from(timeEntries)
      .innerJoin(persons, eq(persons.id, timeEntries.personId))
      .where(eq(timeEntries.projectId, projectId))
      .groupBy(timeEntries.area, persons.professionalCategory),
  ])

  const consumed: ConsumedMap = {}
  for (const r of consumedRows) {
    const area = r.area as Area
    const role = r.role as Role
    if (!consumed[area]) consumed[area] = {}
    consumed[area]![role] = parseFloat(r.hours)
  }

  const effectiveAllocation = computeEffectiveAllocation(
    allocation,
    amendmentRows as Array<{ deltaAllocation: Record<string, Record<string, number>> }>,
  )

  const matrix = buildMatrix(effectiveAllocation, consumed)
  const totals = getProjectTotals(matrix)

  let cumulative = 0
  const burnData = weekRows.map((r) => {
    cumulative += parseFloat(r.hours)
    return { week: r.week as string, hours: parseFloat(r.hours), cumulative }
  })

  const parsedMarginRows = marginRows.map((r) => ({
    area: r.area,
    role: r.role,
    hours: parseFloat(r.hours),
    costCents: parseFloat(r.costCents),
    soldCents: parseFloat(r.soldCents),
  }))
  const marginMatrix = buildMarginMatrix(parsedMarginRows)
  const marginTotals = getMarginTotals(marginMatrix)

  return {
    type: 'project',
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      workspaceName: project.workspaceName ?? null,
    },
    totals,
    burnData,
    contributors: contributorRows.map((c) => ({
      name: c.name ?? 'Desconocido',
      hours: parseFloat(c.hours),
    })),
    marginTotals,
    amendmentCount: amendmentRows.length,
    generatedAt: new Date().toISOString(),
  }
}

export async function buildWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshotData> {
  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      type: projects.type,
      status: projects.status,
      originalAllocation: projects.originalAllocation,
    })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))

  const projectSnapshots = await Promise.all(
    projectRows.map(async (p) => {
      const allocation = p.originalAllocation as Allocation

      const [consumedRows, amendmentRows, marginRows] = await Promise.all([
        db
          .select({
            area: timeEntries.area,
            role: persons.professionalCategory,
            hours: sql<string>`SUM(${timeEntries.hours})`,
          })
          .from(timeEntries)
          .innerJoin(persons, eq(persons.id, timeEntries.personId))
          .where(eq(timeEntries.projectId, p.id))
          .groupBy(timeEntries.area, persons.professionalCategory),
        db
          .select({ deltaAllocation: amendments.deltaAllocation })
          .from(amendments)
          .where(eq(amendments.projectId, p.id)),
        db
          .select({
            area: timeEntries.area,
            role: persons.professionalCategory,
            hours: sql<string>`SUM(${timeEntries.hours}::numeric)`,
            costCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.costRateAtEntryCents})`,
            soldCents: sql<string>`SUM(${timeEntries.hours}::numeric * ${timeEntries.soldRateAtEntryCents})`,
          })
          .from(timeEntries)
          .innerJoin(persons, eq(persons.id, timeEntries.personId))
          .where(eq(timeEntries.projectId, p.id))
          .groupBy(timeEntries.area, persons.professionalCategory),
      ])

      const consumed: ConsumedMap = {}
      for (const r of consumedRows) {
        const area = r.area as Area
        const role = r.role as Role
        if (!consumed[area]) consumed[area] = {}
        consumed[area]![role] = parseFloat(r.hours)
      }

      const effectiveAllocation = computeEffectiveAllocation(
        allocation,
        amendmentRows as Array<{ deltaAllocation: Record<string, Record<string, number>> }>,
      )
      const matrix = buildMatrix(effectiveAllocation, consumed)
      const totals = getProjectTotals(matrix)

      const parsedMarginRows = marginRows.map((r) => ({
        area: r.area,
        role: r.role,
        hours: parseFloat(r.hours),
        costCents: parseFloat(r.costCents),
        soldCents: parseFloat(r.soldCents),
      }))
      const marginMatrix = buildMarginMatrix(parsedMarginRows)
      const marginTotals = getMarginTotals(marginMatrix)

      return { id: p.id, name: p.name, type: p.type, status: p.status, totals, marginTotals }
    }),
  )

  return {
    type: 'workspace',
    workspace: { id: workspace.id, name: workspace.name },
    projects: projectSnapshots,
    generatedAt: new Date().toISOString(),
  }
}
