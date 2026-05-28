import { redirect } from 'next/navigation'
import { desc, eq, and, sql } from 'drizzle-orm'
import { Stack, Text, Table, TableThead, TableTbody, TableTr, TableTh, TableTd, Badge, Group, Select, Anchor } from '@mantine/core'
import Link from 'next/link'
import { db } from '@/lib/db'
import { auditLogEntries, persons } from '@/db/schema'
import { requireRole } from '@/lib/auth-helpers'
import AuditPagination from './audit-pagination'

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  'time_entry.create': 'Entrada creada',
  'time_entry.delete': 'Entrada eliminada',
  'project.status_change': 'Estado cambiado',
  'project.duplicate': 'Proyecto duplicado',
  'project.allocation_update': 'Asignación actualizada',
  'amendment.create': 'Amendment creado',
  'hour_transfer.create': 'Transfer de horas',
  'report.create': 'Report creado',
  'report.close': 'Report cerrado',
  'report.snapshot.create': 'Snapshot creado',
  'report.share_with_committee': 'Compartido con comité',
  'rate.upsert': 'Tarifa actualizada',
  'rate.delete': 'Tarifa eliminada',
  'person.deactivate': 'Persona desactivada',
  'person.anonymize': 'Persona anonimizada (GDPR)',
  'project.assignment.upsert': 'Asignación de equipo',
  'project.assignment.deactivate': 'Asignación desactivada',
  'time_off.create': 'Día libre añadido',
  'time_off.delete': 'Día libre eliminado',
}

const ENTITY_LABELS: Record<string, string> = {
  time_entry: 'Entrada de tiempo',
  project: 'Proyecto',
  amendment: 'Amendment',
  hour_transfer: 'Transfer',
  report: 'Report',
  rate: 'Tarifa',
  person: 'Persona',
  time_off: 'Día libre',
}

const ACTION_COLOR: Record<string, string> = {
  'time_entry.create': 'green',
  'time_entry.delete': 'red',
  'project.status_change': 'blue',
  'project.duplicate': 'gray',
  'project.allocation_update': 'blue',
  'amendment.create': 'orange',
  'hour_transfer.create': 'violet',
  'report.create': 'teal',
  'report.close': 'red',
  'report.snapshot.create': 'teal',
  'report.share_with_committee': 'teal',
  'rate.upsert': 'yellow',
  'rate.delete': 'red',
  'person.deactivate': 'orange',
  'person.anonymize': 'red',
  'project.assignment.upsert': 'blue',
  'project.assignment.deactivate': 'gray',
  'time_off.create': 'green',
  'time_off.delete': 'red',
}

type Props = { searchParams: Promise<{ page?: string; entity?: string }> }

export default async function AuditPage({ searchParams }: Props) {
  let actor: Awaited<ReturnType<typeof requireRole>>
  try {
    actor = await requireRole('admin')
  } catch {
    redirect('/today')
  }

  const { page: pageParam, entity: entityFilter } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const conditions = [eq(auditLogEntries.organizationId, actor.organizationId)]
  if (entityFilter) conditions.push(eq(auditLogEntries.entityType, entityFilter))

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: auditLogEntries.id,
        action: auditLogEntries.action,
        entityType: auditLogEntries.entityType,
        entityId: auditLogEntries.entityId,
        createdAt: auditLogEntries.createdAt,
        actorName: persons.name,
      })
      .from(auditLogEntries)
      .leftJoin(persons, eq(persons.id, auditLogEntries.actorId))
      .where(and(...conditions))
      .orderBy(desc(auditLogEntries.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogEntries)
      .where(and(...conditions)),
  ])

  const total = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Distinct entity types for the filter
  const entityTypes = await db
    .selectDistinct({ entityType: auditLogEntries.entityType })
    .from(auditLogEntries)
    .where(eq(auditLogEntries.organizationId, actor.organizationId))
    .orderBy(auditLogEntries.entityType)

  return (
    <Stack p="md" gap="xl">
      <Group justify="space-between" align="center">
        <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Registro de actividad
        </Text>
        <Text size="xs" c="dimmed">{total.toLocaleString('es-ES')} eventos</Text>
      </Group>

      {/* Filter row */}
      <AuditPagination
        page={page}
        totalPages={totalPages}
        entityFilter={entityFilter ?? null}
        entityOptions={[
          { value: '', label: 'Todos los tipos' },
          ...entityTypes.map((e) => ({
            value: e.entityType,
            label: ENTITY_LABELS[e.entityType] ?? e.entityType,
          })),
        ]}
      />

      {rows.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No hay eventos registrados{entityFilter ? ' para este tipo de entidad' : ''}.
        </Text>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <Table withTableBorder withColumnBorders fz="sm">
            <TableThead>
              <TableTr>
                <TableTh style={{ minWidth: 160 }}>Fecha y hora</TableTh>
                <TableTh>Actor</TableTh>
                <TableTh>Acción</TableTh>
                <TableTh>Entidad</TableTh>
                <TableTh style={{ minWidth: 120 }}>ID</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {rows.map((row) => (
                <TableTr key={row.id}>
                  <TableTd style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    <Text size="xs">
                      {row.createdAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {row.createdAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TableTd>
                  <TableTd>
                    <Text size="xs">{row.actorName ?? 'Sistema'}</Text>
                  </TableTd>
                  <TableTd>
                    <Badge size="xs" color={ACTION_COLOR[row.action] ?? 'gray'} variant="light">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </Badge>
                  </TableTd>
                  <TableTd>
                    <Text size="xs" c="dimmed">{ENTITY_LABELS[row.entityType] ?? row.entityType}</Text>
                  </TableTd>
                  <TableTd>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                      {row.entityId.slice(0, 8)}…
                    </Text>
                  </TableTd>
                </TableTr>
              ))}
            </TableTbody>
          </Table>
        </div>
      )}
    </Stack>
  )
}
