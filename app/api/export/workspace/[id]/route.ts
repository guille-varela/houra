import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { persons, projects, timeEntries, workspaces } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'

const AREA_LABELS: Record<string, string> = { ux: 'UX', ui: 'UI', research: 'Research' }
const ROLE_LABELS: Record<string, string> = {
  trainee: 'Trainee', junior: 'Junior', mid: 'Mid',
  senior: 'Senior', lead: 'Lead', head: 'Head',
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id: workspaceId } = await params

  const [workspace] = await db
    .select({ name: workspaces.name, organizationId: workspaces.organizationId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1)

  if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
  if (workspace.organizationId !== person.organizationId) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))

  if (projectRows.length === 0) {
    return NextResponse.json({ error: 'Sin proyectos' }, { status: 404 })
  }

  const projectMap = Object.fromEntries(projectRows.map((p) => [p.id, p.name]))
  const projectIds = projectRows.map((p) => p.id)

  const rows = await db
    .select({
      date: timeEntries.date,
      projectId: timeEntries.projectId,
      hours: timeEntries.hours,
      area: timeEntries.area,
      description: timeEntries.description,
      costRateCents: timeEntries.costRateAtEntryCents,
      soldRateCents: timeEntries.soldRateAtEntryCents,
      personName: persons.name,
      personRole: persons.professionalCategory,
    })
    .from(timeEntries)
    .innerJoin(persons, eq(persons.id, timeEntries.personId))
    .where(inArray(timeEntries.projectId, projectIds))
    .orderBy(desc(timeEntries.date))

  const data = rows.map((r) => {
    const h = parseFloat(r.hours)
    return {
      Fecha: r.date,
      Proyecto: projectMap[r.projectId] ?? r.projectId,
      Persona: r.personName,
      Rol: ROLE_LABELS[r.personRole] ?? r.personRole,
      Área: AREA_LABELS[r.area] ?? r.area,
      Horas: h,
      Descripción: r.description ?? '',
      'Coste (€)': ((r.costRateCents * h) / 100).toFixed(2),
      'Ingresos (€)': ((r.soldRateCents * h) / 100).toFixed(2),
    }
  })

  const safeName = workspace.name.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase()
  const date = new Date().toISOString().slice(0, 10)

  // CSV con BOM UTF-8 para que Excel respete los acentos al abrirlo.
  const header = Object.keys(data[0] ?? {}).join(',')
  const csvRows = data.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = '﻿' + [header, ...csvRows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}_${date}.csv"`,
    },
  })
}
