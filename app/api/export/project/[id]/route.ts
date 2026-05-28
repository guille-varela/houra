import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { persons, projects, timeEntries } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

const ROLE_LABELS: Record<string, string> = {
  trainee: 'Trainee',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  head: 'Head',
}

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  let person
  try {
    person = await requireRole('manager')
  } catch {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { id: projectId } = await params
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'

  const [project] = await db
    .select({ name: projects.name, organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  if (project.organizationId !== person.organizationId) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const rows = await db
    .select({
      date: timeEntries.date,
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
    .where(eq(timeEntries.projectId, projectId))
    .orderBy(desc(timeEntries.date))

  const data = rows.map((r) => {
    const h = parseFloat(r.hours)
    return {
      Fecha: r.date,
      Persona: r.personName,
      Rol: ROLE_LABELS[r.personRole] ?? r.personRole,
      Área: AREA_LABELS[r.area] ?? r.area,
      Horas: h,
      Descripción: r.description ?? '',
      'Coste (€)': ((r.costRateCents * h) / 100).toFixed(2),
      'Ingresos (€)': ((r.soldRateCents * h) / 100).toFixed(2),
    }
  })

  const safeName = project.name.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase()
  const date = new Date().toISOString().slice(0, 10)

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Entradas')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
    const blob = new Blob([new Uint8Array(buf)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    return new NextResponse(blob, {
      headers: {
        'Content-Disposition': `attachment; filename="${safeName}_${date}.xlsx"`,
      },
    })
  }

  // CSV
  const header = Object.keys(data[0] ?? {}).join(',')
  const csvRows = data.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = [header, ...csvRows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}_${date}.csv"`,
    },
  })
}
