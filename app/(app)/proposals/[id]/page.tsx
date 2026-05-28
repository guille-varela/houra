import { notFound, redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { Stack, Group, Badge, Text, Card } from '@mantine/core'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-helpers'
import { persons } from '@/db/schema'
import { getProposal, getProposalPhases, getProposalStaffing } from '@/actions/proposals'
import { getClients } from '@/actions/clients'
import ProposalTabs from './proposal-tabs'
import SummaryTab from './summary-tab'
import StaffingTab from './staffing-tab'
import MarginTab from './margin-tab'
import ProposalSettingsTab from './settings-tab'
import type { ProposalStatus } from '@/actions/proposals'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  internal_review: 'Revisión interna',
  pending_approval: 'Pendiente aprobación',
  approved: 'Aprobada',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'gray',
  internal_review: 'blue',
  pending_approval: 'orange',
  approved: 'green',
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

  const [phases, staffing, clientList, teamPeople] = await Promise.all([
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
  ])

  const isAdmin = person.appRole === 'admin'
  const activeTab = tab ?? 'summary'

  return (
    <Stack p="md" gap="md">
      <Card p="md">
        <Group justify="space-between" align="flex-start">
          <Text style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {proposal.name}
          </Text>
          <Badge color={STATUS_COLOR[proposal.status] ?? 'gray'} variant="light">
            {STATUS_LABELS[proposal.status] ?? proposal.status}
          </Badge>
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
            internalNotes={proposal.internalNotes ?? null}
            clients={clientList.map((c) => ({ id: c.id, name: c.name }))}
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
