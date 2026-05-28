'use client'

import { useState, useMemo } from 'react'
import {
  Stack, Group, Text, Badge, Alert, Progress, SimpleGrid,
  Card, SegmentedControl, TextInput, ActionIcon, Anchor,
  Table, TableThead, TableTbody, TableTr, TableTh, TableTd, ScrollArea,
} from '@mantine/core'
import {
  IconSearch, IconSun, IconAlertTriangle, IconTable,
  IconTimeline, IconLayoutGrid, IconExternalLink, IconBrandGoogleBigQuery,
} from '@tabler/icons-react'
import { GanttVacaciones } from './gantt-vacaciones'
import type { PersonBalance, VacationRange } from '@/lib/sheets-vacaciones'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OverlapWarning = { start: string; end: string; names: string[]; reason: string }
type View = 'tabla' | 'gantt' | 'equipo'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_ES[m! - 1]}`
}

function formatRange(r: { start: string; end: string }): string {
  if (r.start === r.end) return shortDate(r.start)
  const [sy] = r.start.split('-').map(Number)
  const [ey] = r.end.split('-').map(Number)
  if (sy === ey) return `${shortDate(r.start)} – ${shortDate(r.end)}`
  return `${shortDate(r.start)} ${sy} – ${shortDate(r.end)} ${ey}`
}

function isActive(r: VacationRange, today: string) {
  return r.start <= today && r.end >= today
}

function isUpcoming(r: VacationRange, today: string) {
  return r.start > today
}

// ─── Search filter ────────────────────────────────────────────────────────────

function filterPeople(people: PersonBalance[], q: string, overlaps: OverlapWarning[], today: string): PersonBalance[] {
  const term = q.toLowerCase().trim()
  if (!term) return people

  return people.filter((p) => {
    // nombre
    if (p.name.toLowerCase().includes(term)) return true
    // estado vacaciones
    const hasAprobado  = p.vacations.some((v) => v.status === 'aprobado')
    const hasPendiente = p.vacations.some((v) => v.status === 'pendiente')
    const hasPaternal  = p.vacations.some((v) => v.status === 'baja_paternal')
    if (term === 'aprobado' && hasAprobado) return true
    if ((term === 'pendiente' || term === 'solicitud') && hasPendiente) return true
    if ((term === 'paternal' || term === 'baja') && hasPaternal) return true
    // periodo — busca mes o fecha
    const matchesPeriod = p.vacations.some((v) => {
      const [, m] = v.start.split('-').map(Number)
      const monthName = MONTHS_ES[m! - 1] ?? ''
      return v.start.includes(term) || v.end.includes(term) || monthName.includes(term)
    })
    if (matchesPeriod) return true
    // alertas / coincidencias
    if ((term === 'alerta' || term === 'solapamiento' || term === 'coincidencia') &&
        overlaps.some((o) => o.names.includes(p.name))) return true
    // bekind
    if (term === 'bekind' && p.beKind) return true
    // de vacaciones ahora
    if ((term === 'vacaciones' || term === 'activo') &&
        p.vacations.some((v) => isActive(v, today))) return true
    return false
  })
}

// ─── Saldos table ─────────────────────────────────────────────────────────────

function SaldosTable({ people, year }: { people: PersonBalance[]; year: number }) {
  const sorted = [...people].sort((a, b) => {
    if (a.isBaja !== b.isBaja) return a.isBaja ? 1 : -1
    return a.diasDisponibles - b.diasDisponibles
  })
  return (
    <ScrollArea>
      <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm" style={{ minWidth: 560 }}>
        <TableThead>
          <TableTr>
            <TableTh>Persona</TableTh>
            <TableTh style={{ textAlign: 'right' }}>Días n</TableTh>
            <TableTh style={{ textAlign: 'right' }}>Arrastre n-1</TableTh>
            <TableTh style={{ textAlign: 'right' }}>Usados</TableTh>
            <TableTh style={{ textAlign: 'right' }}>Restantes</TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {sorted.map((p) => {
            const n1Alert = p.diasN1 > 0
            const lowDays = !p.isBaja && p.diasDisponibles <= 5
            return (
              <TableTr key={p.name} style={{ opacity: p.isBaja ? 0.5 : 1 }}>
                <TableTd>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={500}>{p.name}</Text>
                    {p.isBaja && <Badge size="xs" color="gray" variant="light">Baja</Badge>}
                  </Group>
                </TableTd>
                <TableTd style={{ textAlign: 'right' }}>{p.diasN}</TableTd>
                <TableTd style={{ textAlign: 'right' }}>
                  {p.diasN1 > 0 ? (
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Text size="sm" {...(n1Alert && { c: 'red', fw: 600 })}>{p.diasN1}</Text>
                      {n1Alert && (
                        <Badge size="xs" color="red" variant="light" leftSection={<IconAlertTriangle size={10} />}>
                          vence mar {year + 1}
                        </Badge>
                      )}
                    </Group>
                  ) : <Text size="sm" c="dimmed">—</Text>}
                </TableTd>
                <TableTd style={{ textAlign: 'right' }}>{p.diasUsados}</TableTd>
                <TableTd style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={600} {...(lowDays && { c: 'red' })}>{p.diasDisponibles}</Text>
                </TableTd>
              </TableTr>
            )
          })}
        </TableTbody>
      </Table>
    </ScrollArea>
  )
}

// ─── Balance card ─────────────────────────────────────────────────────────────

function BalanceCard({ person, today }: { person: PersonBalance; today: string }) {
  const pct = person.diasTotal > 0 ? Math.round((person.diasUsados / person.diasTotal) * 100) : 0
  const activeNow = person.vacations.some((r) => isActive(r, today))
  const upcoming  = person.vacations.filter((r) => isUpcoming(r, today))

  return (
    <Card p="md" radius="md" withBorder style={{ borderColor: activeNow ? 'var(--mantine-color-teal-3)' : 'var(--h-bd)' }}>
      <Group justify="space-between" align="flex-start" mb={8}>
        <Group gap={6} align="center">
          <Text fw={700} size="sm">{person.name}</Text>
          {person.isBaja && <Badge size="xs" color="gray" variant="light">Baja</Badge>}
          {!person.isBaja && activeNow && <Badge size="xs" color="teal" variant="filled">De vacaciones</Badge>}
        </Group>
        <Text size="xs" c="dimmed" fw={600}>{person.diasDisponibles} días restantes</Text>
      </Group>

      <Progress value={pct} size="xs" radius="xl" color={pct > 80 ? 'orange' : 'blue'} mb={6} />

      <Group justify="space-between" mb={upcoming.length > 0 ? 8 : 0}>
        <Text size="xs" c="dimmed">
          {person.diasUsados} de {person.diasTotal} días usados
          {person.diasN1 > 0 && <Text span c="dimmed"> · {person.diasN1} de arrastre</Text>}
        </Text>
        <Text size="xs" c="dimmed">{pct}%</Text>
      </Group>

      {upcoming.length > 0 && (
        <Stack gap={4} mt={4}>
          {upcoming.slice(0, 3).map((r, i) => (
            <Group key={i} gap={6} align="center" wrap="nowrap">
              <Badge size="xs" variant="dot" color={r.status === 'aprobado' ? 'green' : r.status === 'baja_paternal' ? 'violet' : 'yellow'} style={{ flexShrink: 0 }}>
                {r.status === 'aprobado' ? 'Aprobado' : r.status === 'baja_paternal' ? 'Paternal' : 'Pendiente'}
              </Badge>
              <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
                {formatRange(r)} · {r.days} {r.days === 1 ? 'día' : 'días'}
              </Text>
            </Group>
          ))}
          {upcoming.length > 3 && <Text size="xs" c="dimmed">+{upcoming.length - 3} periodos más</Text>}
        </Stack>
      )}
    </Card>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function VacacionesClient({
  productPeople,
  croPeople,
  overlaps,
  holidays,
  personRegions,
  today,
  year,
  sheetUrl,
}: {
  productPeople: PersonBalance[]
  croPeople: PersonBalance[]
  overlaps: OverlapWarning[]
  holidays: Record<string, string[]>
  personRegions: Record<string, string>
  today: string
  year: number
  sheetUrl: string
}) {
  const [view, setView]       = useState<View>('gantt')
  const [search, setSearch]   = useState('')

  const filtered = useMemo(
    () => filterPeople(productPeople, search, overlaps, today),
    [productPeople, search, overlaps, today],
  )

  const sortedForCards = useMemo(
    () => [...filtered].sort((a, b) => {
      const aActive = a.vacations.some((r) => isActive(r, today)) ? 0 : 1
      const bActive = b.vacations.some((r) => isActive(r, today)) ? 0 : 1
      return aActive - bActive || a.name.localeCompare(b.name)
    }),
    [filtered, today],
  )

  const visibleOverlaps = search
    ? overlaps.filter((o) => o.names.some((n) => filtered.some((p) => p.name === n)))
    : overlaps

  return (
    <Stack p="md" gap="xl">

      {/* Header */}
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap={8} align="center">
          <Text style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Vacaciones del equipo
          </Text>
          <Anchor href={sheetUrl} target="_blank" rel="noopener" size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconBrandGoogleBigQuery size={14} />
            Sheet
          </Anchor>
          <Anchor href="https://hcm17.sapsf.com/sf/home?bplte_company=globant#/" target="_blank" rel="noopener" size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconExternalLink size={14} />
            Ver en SuccessFactors
          </Anchor>
        </Group>
        <Text size="xs" c="dimmed">{year} · actualización cada hora</Text>
      </Group>

      {/* Warnings */}
      {visibleOverlaps.length > 0 && (
        <Stack gap="xs">
          {visibleOverlaps.map((o, i) => (
            <Alert key={i} icon={<IconAlertTriangle size={16} />} color="orange" variant="light" p="xs">
              <Text size="sm">
                <Text span fw={600}>{o.reason}</Text>
                {' · '}
                <Text span fw={600}>{formatRange({ start: o.start, end: o.end })}</Text>
                {' '}— {o.names.join(' + ')}
              </Text>
            </Alert>
          ))}
        </Stack>
      )}

      {/* Controls */}
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as View)}
          size="xs"
          data={[
            { label: 'Gantt', value: 'gantt' },
            { label: 'Saldos', value: 'tabla' },
            { label: 'Equipo', value: 'equipo' },
          ]}
        />
        <TextInput
          placeholder="Buscar por nombre, mes, pendiente, alerta…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="xs"
          style={{ width: 280 }}
        />
      </Group>

      {/* View */}
      {view === 'gantt' && (
        <GanttVacaciones
          people={filtered}
          today={today}
          holidays={holidays}
          personRegions={personRegions}
        />
      )}

      {view === 'tabla' && <SaldosTable people={filtered} year={year} />}

      {view === 'equipo' && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {sortedForCards.map((p) => (
            <BalanceCard key={p.name} person={p} today={today} />
          ))}
        </SimpleGrid>
      )}

      {/* CRO */}
      {croPeople.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>CRO</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {croPeople.map((p) => <BalanceCard key={p.name} person={p} today={today} />)}
          </SimpleGrid>
        </Stack>
      )}

    </Stack>
  )
}
