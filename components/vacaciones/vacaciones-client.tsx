'use client'

import { useState, useMemo } from 'react'
import {
  Stack, Group, Text, Badge, Alert, Progress, SimpleGrid,
  Card, SegmentedControl, TextInput, Anchor, Divider, Drawer,
  Table, TableThead, TableTbody, TableTr, TableTh, TableTd, ScrollArea,
  RingProgress, ThemeIcon,
} from '@mantine/core'
import {
  IconSearch, IconAlertTriangle, IconExternalLink, IconBrandGoogleBigQuery,
  IconCalendar, IconCheck, IconClock, IconAlertCircle,
} from '@tabler/icons-react'
import type { VacationEvent } from '@/lib/vacation-calendar'
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

// ─── Calendar event card ──────────────────────────────────────────────────────

function CalEventCard({ event, today }: { event: VacationEvent; today: string }) {
  const active = event.start <= today && event.end >= today
  const past   = event.end < today
  return (
    <Card p="sm" radius="md" withBorder style={{
      borderColor: active ? 'var(--mantine-color-blue-3)' : 'var(--h-bd)',
      background:  active ? 'var(--mantine-color-blue-0)' : undefined,
      opacity: past ? 0.6 : 1,
    }}>
      <Group justify="space-between" align="flex-start" gap="sm">
        <div>
          <Text fw={600} size="sm">{event.summary}</Text>
          <Text size="xs" c="dimmed" mt={2}>
            {formatRange({ start: event.start, end: event.end })}
          </Text>
        </div>
        {active && <Badge size="xs" color="blue" variant="filled">Ahora</Badge>}
      </Group>
    </Card>
  )
}

// ─── Person drawer ────────────────────────────────────────────────────────────

function PersonDrawer({
  person,
  today,
  year,
  overlaps,
  onClose,
}: {
  person: PersonBalance | null
  today: string
  year: number
  overlaps: OverlapWarning[]
  onClose: () => void
}) {
  if (!person) return null

  const pct      = person.diasTotal > 0 ? Math.round((person.diasUsados / person.diasTotal) * 100) : 0
  const activeNow = person.vacations.some((v) => isActive(v, today))
  const myOverlaps = overlaps.filter((o) => o.names.includes(person.name))

  const past     = person.vacations.filter((v) => v.end < today && v.status !== 'bloqueado').sort((a, b) => b.start.localeCompare(a.start))
  const current  = person.vacations.filter((v) => isActive(v, today) && v.status !== 'bloqueado')
  const upcoming = person.vacations.filter((v) => isUpcoming(v, today) && v.status !== 'bloqueado').sort((a, b) => a.start.localeCompare(b.start))

  const statusColor = (s: string) => s === 'aprobado' ? 'green' : s === 'baja_paternal' ? 'violet' : 'yellow'
  const statusLabel = (s: string) => s === 'aprobado' ? 'Aprobado' : s === 'baja_paternal' ? 'Paternal' : 'Pendiente'

  return (
    <Drawer
      opened={!!person}
      onClose={onClose}
      title={
        <Group gap={8}>
          <Text fw={700} size="lg">{person.name}</Text>
          {person.isBaja && <Badge color="gray" variant="light" size="sm">Baja</Badge>}
          {activeNow && <Badge color="teal" variant="filled" size="sm">De vacaciones</Badge>}
        </Group>
      }
      position="right"
      size="sm"
      padding="lg"
    >
      <Stack gap="lg">

        {/* Ring + saldos */}
        <Group align="flex-start" gap="xl">
          <RingProgress
            size={100}
            thickness={8}
            roundCaps
            sections={[{ value: pct, color: pct > 80 ? 'orange' : 'blue' }]}
            label={
              <Text ta="center" fw={700} size="sm">{pct}%</Text>
            }
          />
          <Stack gap={4} style={{ flex: 1 }}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Días {year}</Text>
              <Text size="sm" fw={600}>{person.diasN}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Arrastre n-1</Text>
              <Group gap={6}>
                <Text size="sm" fw={600} {...(person.diasN1 > 0 && { c: 'red' })}>{person.diasN1 || '—'}</Text>
                {person.diasN1 > 0 && <Text size="xs" c="red">vence mar {year + 1}</Text>}
              </Group>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Usados</Text>
              <Text size="sm" fw={600}>{person.diasUsados}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Restantes</Text>
              <Text size="sm" fw={700} {...(person.diasDisponibles <= 5 && { c: 'red' })}>{person.diasDisponibles}</Text>
            </Group>
          </Stack>
        </Group>

        {/* Baja de larga duración */}
        {(person.isBaja || person.isExcedencia || upcoming.some((v) => v.status === 'baja_paternal')) && (
          <Alert
            color={person.isBaja ? 'gray' : person.isExcedencia ? 'orange' : 'violet'}
            variant="light"
            icon={<IconAlertCircle size={16} />}
          >
            <Stack gap={2}>
              {person.isBaja && (
                <Text size="sm" fw={600}>Baja permanente</Text>
              )}
              {person.isExcedencia && (
                <Text size="sm" fw={600}>Excedencia activa</Text>
              )}
              {upcoming.filter((v) => v.status === 'baja_paternal').map((v, i) => (
                <Text key={i} size="sm" fw={600}>
                  Baja paternal · {formatRange(v)} ({v.days} días)
                </Text>
              ))}
              {current.filter((v) => v.status === 'baja_paternal').map((v, i) => (
                <Text key={i} size="sm" fw={600}>
                  Baja paternal en curso · hasta {formatRange({ start: v.end, end: v.end })}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        {/* Alertas */}
        {myOverlaps.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Alertas</Text>
            {myOverlaps.map((o, i) => (
              <Alert key={i} icon={<IconAlertTriangle size={14} />} color="orange" variant="light" p="xs">
                <Text size="xs">{o.reason} · {formatRange({ start: o.start, end: o.end })}</Text>
              </Alert>
            ))}
          </Stack>
        )}

        {/* Ahora */}
        {current.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Ahora</Text>
            {current.map((v, i) => (
              <Group key={i} gap={8} align="center">
                <ThemeIcon size="xs" color={statusColor(v.status)} variant="filled" radius="xl">
                  <IconCheck size={8} />
                </ThemeIcon>
                <Text size="sm">{formatRange(v)} · {v.days}d</Text>
              </Group>
            ))}
          </Stack>
        )}

        {/* Próximas */}
        {upcoming.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Próximas</Text>
            {upcoming.map((v, i) => (
              <Group key={i} gap={8} align="center" wrap="nowrap">
                <Badge size="xs" color={statusColor(v.status)} variant="dot" style={{ flexShrink: 0 }}>
                  {statusLabel(v.status)}
                </Badge>
                <Text size="sm" style={{ minWidth: 0 }}>{formatRange(v)} · {v.days}d</Text>
              </Group>
            ))}
          </Stack>
        )}

        {/* Historial */}
        {past.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">Historial {year}</Text>
            {past.slice(0, 5).map((v, i) => (
              <Group key={i} gap={8} align="center" wrap="nowrap">
                <Badge size="xs" color="gray" variant="light" style={{ flexShrink: 0 }}>
                  {statusLabel(v.status)}
                </Badge>
                <Text size="sm" c="dimmed" style={{ minWidth: 0 }}>{formatRange(v)} · {v.days}d</Text>
              </Group>
            ))}
            {past.length > 5 && <Text size="xs" c="dimmed">+{past.length - 5} periodos anteriores</Text>}
          </Stack>
        )}

      </Stack>
    </Drawer>
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
  calEvents = [],
}: {
  productPeople: PersonBalance[]
  croPeople: PersonBalance[]
  overlaps: OverlapWarning[]
  holidays: Record<string, string[]>
  personRegions: Record<string, string>
  today: string
  year: number
  sheetUrl: string
  calEvents?: VacationEvent[]
}) {
  const [view, setView]           = useState<View>('gantt')
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<PersonBalance | null>(null)

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

  const calActive   = calEvents.filter((e) => e.start <= today && e.end >= today)
  const calUpcoming = calEvents.filter((e) => e.start > today)
  const calPast     = calEvents.filter((e) => e.end < today)

  return (
    <Stack p="md" gap="xl">

      <PersonDrawer
        person={selected}
        today={today}
        year={year}
        overlaps={overlaps}
        onClose={() => setSelected(null)}
      />

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

      {/* Calendario iCal — siempre visible, arriba */}
      {calEvents.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
            Calendario · Vacaciones Product
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
            {calActive.length > 0 && calActive.map((e) => <CalEventCard key={e.uid} event={e} today={today} />)}
            {calUpcoming.map((e) => <CalEventCard key={e.uid} event={e} today={today} />)}
            {calPast.map((e) => <CalEventCard key={e.uid} event={e} today={today} />)}
          </SimpleGrid>
        </Stack>
      )}

      <Divider />

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
            <div key={p.name} onClick={() => setSelected(p)} style={{ cursor: 'pointer' }}>
              <BalanceCard person={p} today={today} />
            </div>
          ))}
        </SimpleGrid>
      )}


      {/* CRO */}
      {croPeople.length > 0 && (
        <Stack gap="sm">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>CRO</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {croPeople.map((p) => (
              <div key={p.name} onClick={() => setSelected(p)} style={{ cursor: 'pointer' }}>
                <BalanceCard person={p} today={today} />
              </div>
            ))}
          </SimpleGrid>
        </Stack>
      )}

    </Stack>
  )
}
