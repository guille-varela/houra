import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { Stack, SimpleGrid, Card, Text, Group, Badge, Table, TableThead, TableTbody, TableTr, TableTh, TableTd, TableTfoot, Alert } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-helpers'
import { rates, clients, persons, proposals, proposalPhases, proposalStaffing } from '@/db/schema'
import { formatEur } from '@/lib/margin'
import { marginColor } from '@/lib/tokens'
import InfoTooltip from '@/components/ui/info-tooltip'
import FrameworkRateToggle from './framework-rate-toggle'
import MarginSuggestions from './margin-suggestions'
import { computeMarginSuggestions, type SuggestionLine } from '@/lib/margin-suggestions'

const METRIC_HELP = {
  hours: 'Suma de horas asignadas a todos los perfiles de la propuesta.',
  cost: 'Σ (horas × coste/hora) por cada perfil. El coste/hora sale de la tarifa vigente a la fecha de la propuesta.',
  revenue: 'Σ (horas × venta/hora) por cada perfil. La venta/hora sale del acuerdo marco si aplica, o de la tarifa estándar.',
  margin: '(Ingresos − Coste) ÷ Ingresos × 100. El importe en euros es Ingresos − Coste.',
}

type RateRow = typeof rates.$inferSelect
type ClientRow = typeof clients.$inferSelect

function rateFor(area: string, role: string, orgRates: RateRow[]) {
  const wsRate = orgRates.find((r) => r.area === area && r.role === role && r.workspaceId !== null)
  const baseRate = orgRates.find((r) => r.area === area && r.role === role && r.workspaceId === null)
  const r = wsRate ?? baseRate
  return { costRateCents: r?.costRateCents ?? null, soldRateCents: r?.soldRateCents ?? null }
}

function marcoSoldRateCents(role: string, client: ClientRow): number | null {
  if (!client.marcoUsePerRoleRates) return client.marcoGlobalRateCents ?? null
  const perRole = (client.marcoRateByCategory as Record<string, number | null> | null)?.[role]
  return perRole ?? client.marcoGlobalRateCents ?? null
}

type ScenarioLine = {
  label: string
  area: string
  hours: number
  costCents: number
  revenueScenario1Cents: number
  revenueScenario2Cents: number | null
}

function marginPct(rev: number, cost: number) {
  return rev > 0 ? ((rev - cost) / rev) * 100 : null
}

function ScenarioCard({
  title,
  subtitle,
  revenue,
  cost,
  totalHours,
  targetPct,
  available = true,
  unavailableReason,
}: {
  title: string
  subtitle: string
  revenue: number
  cost: number
  totalHours: number
  targetPct: number | null
  available?: boolean
  unavailableReason?: string
}) {
  const pct = marginPct(revenue, cost)
  const margin = revenue - cost
  const color = pct !== null ? marginColor(pct) : 'gray'
  const targetDelta = targetPct !== null && pct !== null ? pct - targetPct : null

  return (
    <Card p="md" style={{ opacity: available ? 1 : 0.5 }}>
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }} mb={4}>
        {title}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">{subtitle}</Text>

      {!available ? (
        <Text size="sm" c="dimmed">{unavailableReason}</Text>
      ) : (
        <Stack gap={6}>
          <Group justify="space-between">
            <Group gap={2} align="center">
              <Text size="xs" c="dimmed">Horas</Text>
              <InfoTooltip label={METRIC_HELP.hours} size={12} />
            </Group>
            <Text size="sm" fw={500}>{totalHours.toFixed(0)}h</Text>
          </Group>
          <Group justify="space-between">
            <Group gap={2} align="center">
              <Text size="xs" c="dimmed">Coste</Text>
              <InfoTooltip label={METRIC_HELP.cost} size={12} />
            </Group>
            <Text size="sm" fw={500}>{formatEur(cost)}</Text>
          </Group>
          <Group justify="space-between">
            <Group gap={2} align="center">
              <Text size="xs" c="dimmed">Ingresos</Text>
              <InfoTooltip label={METRIC_HELP.revenue} size={12} />
            </Group>
            <Text size="sm" fw={500}>{formatEur(revenue)}</Text>
          </Group>
          <Group justify="space-between" mt={4}>
            <Group gap={2} align="center">
              <Text size="xs" c="dimmed">Margen</Text>
              <InfoTooltip label={METRIC_HELP.margin} size={12} />
            </Group>
            <Group gap={6} align="center">
              <Text size="sm" fw={700} c={color}>
                {pct !== null ? `${pct.toFixed(1)}%` : 'n/d'}
              </Text>
              <Text size="xs" c="dimmed">{formatEur(margin)}</Text>
            </Group>
          </Group>
          {targetDelta !== null && pct !== null && targetPct !== null && (
            <Group justify="flex-end">
              <Badge
                size="xs"
                variant="light"
                color={targetDelta >= 0 ? 'green' : 'red'}
              >
                {Math.abs(targetDelta).toFixed(1)} pp {targetDelta >= 0 ? 'sobre' : 'bajo'} objetivo
                {' · '}{pct.toFixed(0)}% vs {targetPct.toFixed(0)}%
              </Badge>
            </Group>
          )}
        </Stack>
      )}
    </Card>
  )
}

type Props = { proposalId: string }

export default async function MarginTab({ proposalId }: Props) {
  const person = await requireRole('manager')
  const today = new Date().toISOString().split('T')[0]!

  const [proposal, staffingRows, phaseRows, orgRates] = await Promise.all([
    db
      .select({
        clientId: proposals.clientId,
        billingModel: proposals.billingModel,
        targetMarginPercent: proposals.targetMarginPercent,
        useFrameworkAgreementRate: proposals.useFrameworkAgreementRate,
      })
      .from(proposals)
      .where(and(eq(proposals.id, proposalId), eq(proposals.organizationId, person.organizationId)))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select({
        id: proposalStaffing.id,
        area: proposalStaffing.area,
        estimatedHours: proposalStaffing.estimatedHours,
        staffingType: proposalStaffing.staffingType,
        personId: proposalStaffing.personId,
        roleCategory: proposalStaffing.roleCategory,
        personCategory: persons.professionalCategory,
        personName: persons.name,
      })
      .from(proposalStaffing)
      .leftJoin(persons, eq(persons.id, proposalStaffing.personId))
      .where(
        and(
          eq(proposalStaffing.proposalId, proposalId),
          eq(proposalStaffing.organizationId, person.organizationId),
        ),
      ),

    db
      .select({ billingAmount: proposalPhases.billingAmount })
      .from(proposalPhases)
      .where(
        and(
          eq(proposalPhases.proposalId, proposalId),
          eq(proposalPhases.organizationId, person.organizationId),
        ),
      ),

    db
      .select()
      .from(rates)
      .where(
        and(
          eq(rates.organizationId, person.organizationId),
          isNull(rates.personId),
          isNull(rates.projectId),
          lte(rates.effectiveFrom, today),
          or(isNull(rates.effectiveTo), gte(rates.effectiveTo, today)),
        ),
      ),
  ])

  if (!proposal) {
    return <Text size="sm" c="dimmed">Propuesta no encontrada.</Text>
  }

  if (staffingRows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Añade líneas de equipo en la pestaña &quot;Fases y equipo&quot; para ver la calculadora de rentabilidad.
      </Text>
    )
  }

  // Fetch client for marco
  const client = proposal.clientId
    ? await db
        .select()
        .from(clients)
        .where(eq(clients.id, proposal.clientId))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null

  const marcoAvailable = !!(client?.hasMarco)

  // Total fixed billing (for by_phase scenario)
  const totalFixedBillingCents = phaseRows.reduce((acc, p) => {
    return acc + (p.billingAmount ? Math.round(parseFloat(p.billingAmount) * 100) : 0)
  }, 0)
  const fixedBagAvailable = proposal.billingModel === 'by_phase' && totalFixedBillingCents > 0

  // Build scenario lines
  const missingRates: string[] = []
  const lines: ScenarioLine[] = staffingRows.map((s) => {
    const role = s.staffingType === 'person'
      ? (s.personCategory ?? 'mid')
      : (s.roleCategory ?? 'mid')
    const hours = parseFloat(s.estimatedHours)
    const { costRateCents, soldRateCents } = rateFor(s.area, role, orgRates)

    if (costRateCents === null) {
      const key = `${s.area}/${role}`
      if (!missingRates.includes(key)) missingRates.push(key)
    }

    const label = s.staffingType === 'person' && s.personName
      ? `${s.personName} (${s.personCategory ?? '?'})`
      : `${role} · ${s.area.toUpperCase()}`

    const costCents = hours * (costRateCents ?? 0)
    const rev1 = hours * (soldRateCents ?? 0)

    const marcoRate = client ? marcoSoldRateCents(role, client) : null
    const rev2 = marcoAvailable ? hours * (marcoRate ?? soldRateCents ?? 0) : null

    return { label, area: s.area, hours, costCents, revenueScenario1Cents: rev1, revenueScenario2Cents: rev2 }
  })

  const totalHours = lines.reduce((a, l) => a + l.hours, 0)
  const totalCost = lines.reduce((a, l) => a + l.costCents, 0)
  const totalRev1 = lines.reduce((a, l) => a + l.revenueScenario1Cents, 0)
  const totalRev2 = marcoAvailable
    ? lines.reduce((a, l) => a + (l.revenueScenario2Cents ?? l.revenueScenario1Cents), 0)
    : null

  const targetPct = proposal.targetMarginPercent ? parseFloat(proposal.targetMarginPercent) : null

  // F2.12 — cuánto suben los precios al pasar de marco → estándar
  const priceIncreasePct =
    marcoAvailable && totalRev2 != null && totalRev2 > 0
      ? ((totalRev1 - totalRev2) / totalRev2) * 100
      : null

  // F2.11 — sugerencias de margen sobre el escenario aplicado (marco si procede)
  const marcoApplied = marcoAvailable && proposal.useFrameworkAgreementRate
  const appliedRateFor = (area: string, role: string) => {
    const { costRateCents, soldRateCents } = rateFor(area, role, orgRates)
    const sold = marcoApplied && client ? (marcoSoldRateCents(role, client) ?? soldRateCents) : soldRateCents
    return { costRateCents, soldRateCents: sold }
  }
  const suggestionLines: SuggestionLine[] = staffingRows.map((s) => {
    const role = s.staffingType === 'person' ? (s.personCategory ?? 'mid') : (s.roleCategory ?? 'mid')
    const r = appliedRateFor(s.area, role)
    return {
      id: s.id,
      area: s.area,
      role,
      hours: parseFloat(s.estimatedHours),
      costRateCents: r.costRateCents,
      soldRateCents: r.soldRateCents,
    }
  })
  const marginSuggestions = computeMarginSuggestions(suggestionLines, targetPct, appliedRateFor)

  return (
    <Stack gap="xl">
      <FrameworkRateToggle
        proposalId={proposalId}
        marcoAvailable={marcoAvailable}
        initialUseFramework={proposal.useFrameworkAgreementRate}
        clientName={client?.name ?? null}
        clientId={proposal.clientId ?? null}
        priceIncreasePct={priceIncreasePct}
      />

      {missingRates.length > 0 && (
        <Alert
          icon={<IconInfoCircle size={16} />}
          color="yellow"
          variant="light"
          title="Tarifas sin configurar"
        >
          Sin tarifa base para: {missingRates.join(', ')}. Los cálculos que dependen de estas combinaciones muestran 0.
          Pide al admin que configure las tarifas en Configuración.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <ScenarioCard
          title="Tarifas estándar"
          subtitle="Tarifas de venta base de la organización"
          revenue={totalRev1}
          cost={totalCost}
          totalHours={totalHours}
          targetPct={targetPct}
        />
        <ScenarioCard
          title="Acuerdo Marco"
          subtitle={client ? `Tarifas acordadas con ${client.name}` : 'Sin cliente asignado'}
          revenue={totalRev2 ?? 0}
          cost={totalCost}
          totalHours={totalHours}
          targetPct={targetPct}
          available={marcoAvailable}
          unavailableReason={
            !client
              ? 'Asigna un cliente a esta propuesta para ver este escenario.'
              : 'El cliente no tiene Acuerdo Marco activo.'
          }
        />
        <ScenarioCard
          title="Bolsa fija"
          subtitle="Ingresos según importe total de fases"
          revenue={totalFixedBillingCents}
          cost={totalCost}
          totalHours={totalHours}
          targetPct={targetPct}
          available={fixedBagAvailable}
          unavailableReason={
            proposal.billingModel !== 'by_phase'
              ? 'Cambia el modelo de facturación a "Por entregable".'
              : 'Añade importes a las fases para ver este escenario.'
          }
        />
      </SimpleGrid>

      {marginSuggestions.length > 0 && targetPct != null && (
        <MarginSuggestions suggestions={marginSuggestions} targetPct={targetPct} />
      )}

      {/* Desglose por línea */}
      <Stack gap="xs">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
          Desglose por línea de equipo
        </Text>
        <Table withTableBorder withColumnBorders fz="sm">
          <TableThead>
            <TableTr>
              <TableTh>Perfil</TableTh>
              <TableTh ta="right">Horas</TableTh>
              <TableTh ta="right">Coste</TableTh>
              <TableTh ta="right">Estándar</TableTh>
              {marcoAvailable && <TableTh ta="right">Marco</TableTh>}
              {fixedBagAvailable && <TableTh ta="right">Margen bolsa</TableTh>}
            </TableTr>
          </TableThead>
          <TableTbody>
            {lines.map((line, i) => {
              const margin1 = line.revenueScenario1Cents - line.costCents
              const pct1 = marginPct(line.revenueScenario1Cents, line.costCents)
              const rev2 = line.revenueScenario2Cents ?? line.revenueScenario1Cents
              const margin2 = rev2 - line.costCents
              const pct2 = marginPct(rev2, line.costCents)

              // For fixed bag: distribute revenue proportionally by cost
              const fixedLineRev = totalCost > 0
                ? (line.costCents / totalCost) * totalFixedBillingCents
                : 0
              const fixedMarginPct = marginPct(fixedLineRev, line.costCents)

              return (
                <TableTr key={i}>
                  <TableTd>{line.label}</TableTd>
                  <TableTd ta="right">{line.hours.toFixed(0)}h</TableTd>
                  <TableTd ta="right" c="dimmed">{formatEur(line.costCents)}</TableTd>
                  <TableTd ta="right">
                    <Group gap={4} justify="flex-end">
                      <Text size="sm">{formatEur(line.revenueScenario1Cents)}</Text>
                      {pct1 !== null && (
                        <Text size="xs" c={marginColor(pct1)}>{pct1.toFixed(0)}%</Text>
                      )}
                    </Group>
                  </TableTd>
                  {marcoAvailable && (
                    <TableTd ta="right">
                      <Group gap={4} justify="flex-end">
                        <Text size="sm">{formatEur(rev2)}</Text>
                        {pct2 !== null && (
                          <Text size="xs" c={marginColor(pct2)}>{pct2.toFixed(0)}%</Text>
                        )}
                      </Group>
                    </TableTd>
                  )}
                  {fixedBagAvailable && (
                    <TableTd ta="right">
                      {fixedMarginPct !== null && (
                        <Text size="xs" c={marginColor(fixedMarginPct)}>
                          {fixedMarginPct.toFixed(0)}%
                        </Text>
                      )}
                    </TableTd>
                  )}
                </TableTr>
              )
            })}
          </TableTbody>
          <TableTfoot>
            <TableTr style={{ fontWeight: 600 }}>
              <TableTd>Total</TableTd>
              <TableTd ta="right">{totalHours.toFixed(0)}h</TableTd>
              <TableTd ta="right">{formatEur(totalCost)}</TableTd>
              <TableTd ta="right">{formatEur(totalRev1)}</TableTd>
              {marcoAvailable && <TableTd ta="right">{formatEur(totalRev2 ?? 0)}</TableTd>}
              {fixedBagAvailable && <TableTd ta="right">{formatEur(totalFixedBillingCents)}</TableTd>}
            </TableTr>
          </TableTfoot>
        </Table>
      </Stack>
    </Stack>
  )
}
