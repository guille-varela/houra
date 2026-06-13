import { notFound, redirect } from 'next/navigation'
import { eq, and, gte, inArray } from 'drizzle-orm'
import { Stack, Group, Badge, Text, Card, Anchor } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-helpers'
import { persons, holidayPresets, organizations, timeOffEntries } from '@/db/schema'
import { getProposal, getProposalPhases, getProposalStaffing } from '@/actions/proposals'
import { getClients } from '@/actions/clients'
import ProposalTabs from './proposal-tabs'
import SummaryTab from './summary-tab'
import StaffingTab from './staffing-tab'
import MarginTab from './margin-tab'
import ProposalSettingsTab from './settings-tab'
import BackLink from '@/components/ui/back-link'
import type { ProposalStatus } from '@/lib/schemas/proposal'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  internal_review: 'Revisión interna',
  pending_approval: 'Pendiente aprobación',
  approved: 'Aprobada',
  paused: 'Pausada',
  expired: 'Caducada',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  internal_review: 'blue',
  pending_approval: 'orange',
  approved: 'green',
  paused: 'dark',
  expired: 'red',
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function ProposalDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams

  const person = await requireRole('manager').catch(() => null)
  if (!person) redirect('/today')

  const proposal = await getProposal(id)
  if (!proposal) notFound()

  const thisYear = new Date().getFullYear()

  const [phases, staffing, clientList, teamPeople, org, holidayRows] = await Promise.all([
    getProposalPhases(id),
    getProposalStaffing(id),
    getClients(),
    db
      .select({
        id: persons.id,
        name: persons.name,
        professionalCategory: persons.professionalCategory,
      })
      .from(persons)
      .where(eq(persons.organizationId, person.organizationId)),
    db
      .select({
        defaultWeeklyHours: organizations.defaultWeeklyHours,
        defaultTargetMarginPct: organizations.defaultTargetMarginPct,
      })
      .from(organizations)
      .where(eq(organizations.id, person.organizationId))
      .limit(1)
      .then((r) => r[0] ?? null),
    // All years for ES-MD — covers multi-year proposal spans
    db
      .select({ dates: holidayPresets.dates, year: holidayPresets.year })
      .from(holidayPresets)
      .where(eq(holidayPresets.region, 'ES-MD')),
  ])

  // Build flat holiday set from all fetched years
  const holidays: string[] = holidayRows.flatMap((r) =>
    (r.dates as Array<{ date: string }>).map((d) => d.date),
  )
  // hoursPerDay = weeklyHours / 5 work days
  const hoursPerDay = org?.defaultWeeklyHours ? parseFloat(org.defaultWeeklyHours) / 5 : 7.5

  // F2.6 — vacaciones/bajas de las personas concretas asignadas, desde hoy en adelante
  const todayIso = new Date().toISOString().split('T')[0]!
  const assignedPersonIds = [
    ...new Set(staffing.filter((s) => s.staffingType === 'person' && s.personId).map((s) => s.personId!)),
  ]
  const personTimeOff =
    assignedPersonIds.length > 0
      ? await db
          .select({
            personId: timeOffEntries.personId,
            date: timeOffEntries.date,
            type: timeOffEntries.type,
          })
          .from(timeOffEntries)
          .where(
            and(
              eq(timeOffEntries.organizationId, person.organizationId),
              inArray(timeOffEntries.personId, assignedPersonIds),
              inArray(timeOffEntries.type, ['vacation', 'sick_leave']),
              gte(timeOffEntries.date, todayIso),
            ),
          )
      : []

  const isAdmin = person.appRole === 'admin'
  const activeTab = tab ?? 'summary'

  return (
    <Stack p="md" gap="md">
      <BackLink href="/proposals" label="Propuestas" />
      <Card p="md">
        <Group justify="space-between" align="flex-start">
          <Text style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {proposal.name}
          </Text>
          <Group gap="sm" align="center">
            <Anchor
              href={`/proposals/${id}/carta-oferta`}
              target="_blank"
              underline="never"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--h-t2)',
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--h-bd)',
              }}
            >
              <IconFileText size={14} />
              Carta oferta
            </Anchor>
            <Badge color={STATUS_COLOR[proposal.status] ?? 'gray'} variant="light">
              {STATUS_LABELS[proposal.status] ?? proposal.status}
            </Badge>
          </Group>
        </Group>
        {proposal.convertedProjectId && (
          <Text size="xs" c="dimmed" mt={4}>
            Convertida a proyecto
          </Text>
        )}
      </Card>

      <ProposalTabs
        defaultTab={activeTab}
        summary={
          <SummaryTab
            proposalId={id}
            name={proposal.name}
            clientId={proposal.clientId ?? null}
            projectType={proposal.projectType}
            billingModel={proposal.billingModel}
            targetMarginPercent={proposal.targetMarginPercent ?? null}
            useDefaultMargin={proposal.useDefaultMargin}
            totalBagHours={proposal.totalBagHours ?? null}
            orgDefaultMargin={org?.defaultTargetMarginPct ?? '40'}
            internalNotes={proposal.internalNotes ?? null}
            clients={clientList.map((c) => ({ id: c.id, name: c.name, hasMarco: c.hasMarco }))}
          />
        }
        staffing={
          <StaffingTab
            proposalId={id}
            phases={phases.map((p) => ({
              id: p.id,
              name: p.name,
              billingAmount: p.billingAmount ?? null,
              deliveryDate: p.deliveryDate ?? null,
              sortOrder: p.sortOrder,
            }))}
            staffing={staffing.map((s) => ({
              id: s.id,
              phaseId: s.phaseId ?? null,
              staffingType: s.staffingType,
              personId: s.personId ?? null,
              roleCategory: s.roleCategory ?? null,
              area: s.area,
              estimatedHours: s.estimatedHours,
            }))}
            people={teamPeople}
            billingModel={proposal.billingModel}
            hoursPerDay={hoursPerDay}
            holidays={holidays}
            personTimeOff={personTimeOff}
            totalBagHours={proposal.totalBagHours ?? null}
          />
        }
        margin={<MarginTab proposalId={id} />}
        settings={
          <ProposalSettingsTab
            proposalId={id}
            proposalName={proposal.name}
            status={proposal.status as ProposalStatus}
            convertedProjectId={proposal.convertedProjectId ?? null}
            isAdmin={isAdmin}
          />
        }
      />
    </Stack>
  )
}
