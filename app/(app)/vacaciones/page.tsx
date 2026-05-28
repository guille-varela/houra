import { Stack, Group, Text, Card, Badge, Alert, Progress, SimpleGrid, Divider, Table, TableThead, TableTbody, TableTr, TableTh, TableTd, ScrollArea } from '@mantine/core'
import { IconInfoCircle, IconSun, IconAlertTriangle } from '@tabler/icons-react'
import { fetchVacationEvents } from '@/lib/vacation-calendar'
import { fetchSheetVacaciones } from '@/lib/sheets-vacaciones'
import type { VacationEvent } from '@/lib/vacation-calendar'
import type { PersonBalance, VacationRange } from '@/lib/sheets-vacaciones'

export const revalidate = 3600

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_ES[m! - 1]}`
}

function formatRange(r: { start: string; end: string }): string {
  const [sy] = r.start.split('-').map(Number)
  const [ey] = r.end.split('-').map(Number)
  if (r.start === r.end) return shortDate(r.start)
  if (sy === ey) return `${shortDate(r.start)} – ${shortDate(r.end)}`
  return `${shortDate(r.start)} ${sy} – ${shortDate(r.end)} ${ey}`
}

function isActive(r: VacationRange, today: string) {
  return r.start <= today && r.end >= today
}

function isUpcoming(r: VacationRange, today: string) {
  return r.start > today
}

// ─── Balance table ────────────────────────────────────────────────────────────

function SaldosTable({ people, year }: { people: PersonBalance[]; year: number }) {
  const nextMarch = `${year + 1}-03-31`
  // Active people first sorted by restantes asc; baja at the end
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
                    {p.beKind && (
                      <Badge size="xs" color="yellow" variant="light" leftSection={<IconSun size={10} />}>
                        BeKind
                      </Badge>
                    )}
                  </Group>
                </TableTd>
                <TableTd style={{ textAlign: 'right' }}>{p.diasN}</TableTd>
                <TableTd style={{ textAlign: 'right' }}>
                  {p.diasN1 > 0 ? (
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Text size="sm" {...(n1Alert && { c: 'red', fw: 600 })}>
                        {p.diasN1}
                      </Text>
                      {n1Alert && (
                        <Badge size="xs" color="red" variant="light" leftSection={<IconAlertTriangle size={10} />}>
                          vence mar {year + 1}
                        </Badge>
                      )}
                    </Group>
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </TableTd>
                <TableTd style={{ textAlign: 'right' }}>{p.diasUsados}</TableTd>
                <TableTd style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={600} {...(lowDays && { c: 'red' })}>
                    {p.diasDisponibles}
                  </Text>
                </TableTd>
              </TableTr>
            )
          })}
        </TableTbody>
      </Table>
    </ScrollArea>
  )
}

// ─── Calendar event card ──────────────────────────────────────────────────────

function CalEventCard({ event, today }: { event: VacationEvent; today: string }) {
  const active = event.start <= today && event.end >= today
  const past = event.end < today
  return (
    <Card
      p="sm"
      radius="md"
      withBorder
      style={{
        borderColor: active ? 'var(--mantine-color-blue-3)' : 'var(--h-bd)',
        background: active ? 'var(--mantine-color-blue-0)' : undefined,
        opacity: past ? 0.6 : 1,
      }}
    >
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

// ─── Person balance card ──────────────────────────────────────────────────────

function BalanceCard({ person, today }: { person: PersonBalance; today: string }) {
  const pct = person.diasTotal > 0
    ? Math.round((person.diasUsados / person.diasTotal) * 100)
    : 0
  const activeNow = person.vacations.some((r) => isActive(r, today))
  const upcoming = person.vacations.filter((r) => isUpcoming(r, today))

  return (
    <Card p="md" radius="md" withBorder style={{ borderColor: activeNow ? 'var(--mantine-color-teal-3)' : 'var(--h-bd)' }}>
      <Group justify="space-between" align="flex-start" mb={8}>
        <Group gap={6} align="center">
          <Text fw={700} size="sm">{person.name}</Text>
          {person.isBaja && <Badge size="xs" color="gray" variant="light">Baja</Badge>}
          {!person.isBaja && activeNow && <Badge size="xs" color="teal" variant="filled">De vacaciones</Badge>}
          {person.beKind && (
            <Badge size="xs" color="yellow" variant="light" leftSection={<IconSun size={10} />}>
              BeKind
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed" fw={600}>
          {person.diasDisponibles} días restantes
        </Text>
      </Group>

      <Progress
        value={pct}
        size="xs"
        radius="xl"
        color={pct > 80 ? 'orange' : 'blue'}
        mb={6}
      />

      <Group justify="space-between" mb={upcoming.length > 0 ? 8 : 0}>
        <Text size="xs" c="dimmed">
          {person.diasUsados} de {person.diasTotal} días usados
          {person.diasN1 > 0 && (
            <Text span c="dimmed"> · {person.diasN1} de arrastre</Text>
          )}
        </Text>
        <Text size="xs" c="dimmed">{pct}%</Text>
      </Group>

      {upcoming.length > 0 && (
        <Stack gap={4} mt={4}>
          {upcoming.slice(0, 3).map((r, i) => (
            <Group key={i} gap={6} align="center" wrap="nowrap">
              <Badge
                size="xs"
                variant="dot"
                color={r.status === 'aprobado' ? 'green' : 'yellow'}
                style={{ flexShrink: 0 }}
              >
                {r.status === 'aprobado' ? 'Aprobado' : 'Pendiente'}
              </Badge>
              <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
                {formatRange(r)} · {r.days} {r.days === 1 ? 'día' : 'días'}
              </Text>
            </Group>
          ))}
          {upcoming.length > 3 && (
            <Text size="xs" c="dimmed">+{upcoming.length - 3} periodos más</Text>
          )}
        </Stack>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VacacionesPage() {
  const today = new Date().toISOString().split('T')[0]!
  const year = new Date().getFullYear()

  // Ventana iCal: ±14 días / +90 días
  const windowStart = (() => {
    const d = new Date(today); d.setDate(d.getDate() - 14); return d.toISOString().split('T')[0]!
  })()
  const windowEnd = (() => {
    const d = new Date(today); d.setDate(d.getDate() + 90); return d.toISOString().split('T')[0]!
  })()

  const [calEvents, sheetPeople] = await Promise.all([
    fetchVacationEvents(),
    fetchSheetVacaciones(year),
  ])

  const visibleEvents = calEvents
    .filter((e) => e.end >= windowStart && e.start <= windowEnd)
    .sort((a, b) => a.start.localeCompare(b.start))

  const activeEvents   = visibleEvents.filter((e) => e.start <= today && e.end >= today)
  const upcomingEvents = visibleEvents.filter((e) => e.start > today)
  const pastEvents     = visibleEvents.filter((e) => e.end < today)

  // Sheet people sorted: on vacation first, then alphabetical
  const sortedPeople = [...sheetPeople].sort((a, b) => {
    const aActive = a.vacations.some((r) => isActive(r, today)) ? 0 : 1
    const bActive = b.vacations.some((r) => isActive(r, today)) ? 0 : 1
    return aActive - bActive || a.name.localeCompare(b.name)
  })

  const noSheet = !process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  const noCal   = !process.env.VACATION_CALENDAR_ICAL_URL

  return (
    <Stack p="md" gap="xl">

      {/* Header */}
      <Group justify="space-between" align="baseline">
        <Text style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Vacaciones del equipo
        </Text>
        <Text size="xs" c="dimmed">{year} · actualización cada hora</Text>
      </Group>

      {/* ── Saldos (Google Sheets) ─────────────────────────── */}
      <Stack gap="sm">
        <Group gap={6} align="center">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
            Saldos del equipo
          </Text>
          <Text size="xs" c="dimmed">· Google Sheets</Text>
        </Group>

        {noSheet && (
          <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
            No se ha configurado <code>GOOGLE_SHEETS_SPREADSHEET_ID</code>.
          </Alert>
        )}

        {!noSheet && sortedPeople.length === 0 && (
          <Text c="dimmed" size="sm">No se encontraron datos para {year}.</Text>
        )}

        {sortedPeople.length > 0 && (
          <Stack gap="lg">
            <SaldosTable people={sheetPeople} year={year} />
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {sortedPeople.map((p) => (
                <BalanceCard key={p.name} person={p} today={today} />
              ))}
            </SimpleGrid>
          </Stack>
        )}
      </Stack>

      <Divider />

      {/* ── Calendario Google (iCal) ───────────────────────── */}
      <Stack gap="sm">
        <Group gap={6} align="center">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.08em' }}>
            Calendario «Vacaciones Product»
          </Text>
          <Text size="xs" c="dimmed">· Google Calendar</Text>
        </Group>

        {noCal && (
          <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
            No se ha configurado <code>VACATION_CALENDAR_ICAL_URL</code>.
          </Alert>
        )}

        {!noCal && visibleEvents.length === 0 && (
          <Text c="dimmed" size="sm">Sin eventos en los próximos 90 días.</Text>
        )}

        {activeEvents.length > 0 && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={600}>Ahora</Text>
            {activeEvents.map((e) => <CalEventCard key={e.uid} event={e} today={today} />)}
          </Stack>
        )}

        {upcomingEvents.length > 0 && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={600}>Próximas</Text>
            {upcomingEvents.map((e) => <CalEventCard key={e.uid} event={e} today={today} />)}
          </Stack>
        )}

        {pastEvents.length > 0 && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={600}>Últimas 2 semanas</Text>
            {pastEvents.map((e) => <CalEventCard key={e.uid} event={e} today={today} />)}
          </Stack>
        )}
      </Stack>

    </Stack>
  )
}
