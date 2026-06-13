import { eq, and, asc, isNull, gte, lte, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  proposals,
  proposalPhases,
  proposalStaffing,
  clients,
  persons,
  rates,
  organizations,
} from '@/db/schema'

const ROLE_LABELS: Record<string, string> = {
  head: 'Head', lead: 'Lead', senior: 'Senior', mid: 'Mid', junior: 'Junior', trainee: 'Trainee',
}
const AREA_LABELS: Record<string, string> = { research: 'Research', ux: 'UX', ui: 'UI' }

function rateFor(
  area: string,
  role: string,
  orgRates: Array<{ area: string; role: string; soldRateCents: number | null; workspaceId: string | null }>,
): number | null {
  const ws = orgRates.find((r) => r.area === area && r.role === role && r.workspaceId !== null)
  const base = orgRates.find((r) => r.area === area && r.role === role && r.workspaceId === null)
  return (ws ?? base)?.soldRateCents ?? null
}

export type CartaPhase = { id: string; name: string; deliveryDate: string | null; billingAmount: string | null }
export type CartaLine = { label: string; area: string; hours: number; soldRateCents: number | null }

export type CartaOfertaData = {
  name: string
  clientName: string | null
  billingModel: string
  phases: CartaPhase[]
  lines: CartaLine[]
  byPhase: boolean
  totalCents: number
  totalHours: number
}

/**
 * Carga y calcula los datos de la carta oferta de una propuesta.
 * No hace control de acceso — el caller (ruta auth o viewer público con token)
 * es responsable de autorizar. Devuelve null si la propuesta no existe.
 */
export async function getCartaOfertaData(
  proposalId: string,
  organizationId: string,
): Promise<CartaOfertaData | null> {
  const today = new Date().toISOString().split('T')[0]!

  const [proposalRow, phases, staffingRows, orgRates] = await Promise.all([
    db
      .select({
        name: proposals.name,
        billingModel: proposals.billingModel,
        clientName: clients.name,
      })
      .from(proposals)
      .leftJoin(clients, eq(clients.id, proposals.clientId))
      .innerJoin(organizations, eq(organizations.id, proposals.organizationId))
      .where(and(eq(proposals.id, proposalId), eq(proposals.organizationId, organizationId)))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select()
      .from(proposalPhases)
      .where(and(eq(proposalPhases.proposalId, proposalId), eq(proposalPhases.organizationId, organizationId)))
      .orderBy(asc(proposalPhases.sortOrder), asc(proposalPhases.createdAt)),

    db
      .select({
        area: proposalStaffing.area,
        estimatedHours: proposalStaffing.estimatedHours,
        staffingType: proposalStaffing.staffingType,
        roleCategory: proposalStaffing.roleCategory,
        personName: persons.name,
        personCategory: persons.professionalCategory,
      })
      .from(proposalStaffing)
      .leftJoin(persons, eq(persons.id, proposalStaffing.personId))
      .where(and(eq(proposalStaffing.proposalId, proposalId), eq(proposalStaffing.organizationId, organizationId))),

    db
      .select({ area: rates.area, role: rates.role, soldRateCents: rates.soldRateCents, workspaceId: rates.workspaceId })
      .from(rates)
      .where(
        and(
          eq(rates.organizationId, organizationId),
          isNull(rates.personId),
          isNull(rates.projectId),
          lte(rates.effectiveFrom, today),
          or(isNull(rates.effectiveTo), gte(rates.effectiveTo, today)),
        ),
      ),
  ])

  if (!proposalRow) return null

  const lines: CartaLine[] = staffingRows.map((s) => {
    const role = s.staffingType === 'person' ? (s.personCategory ?? 'mid') : (s.roleCategory ?? 'mid')
    const hours = parseFloat(s.estimatedHours)
    const soldRateCents = rateFor(s.area, role, orgRates)
    const label = s.personName
      ? `${s.personName}`
      : `${ROLE_LABELS[role] ?? role} · ${AREA_LABELS[s.area] ?? s.area}`
    return { label, area: s.area, hours, soldRateCents }
  })

  const byPhase = proposalRow.billingModel === 'by_phase'

  const totalCents = byPhase
    ? phases.reduce((acc, p) => acc + (p.billingAmount ? Math.round(parseFloat(p.billingAmount) * 100) : 0), 0)
    : lines.reduce((acc, l) => acc + (l.soldRateCents != null ? Math.round(l.soldRateCents * l.hours) : 0), 0)

  const totalHours = lines.reduce((acc, l) => acc + l.hours, 0)

  return {
    name: proposalRow.name,
    clientName: proposalRow.clientName,
    billingModel: proposalRow.billingModel,
    phases: phases.map((p) => ({
      id: p.id,
      name: p.name,
      deliveryDate: p.deliveryDate ?? null,
      billingAmount: p.billingAmount ?? null,
    })),
    lines,
    byPhase,
    totalCents,
    totalHours,
  }
}
