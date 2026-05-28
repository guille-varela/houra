import { notFound, redirect } from 'next/navigation'
import { eq, and, asc, isNull, gte, lte, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth-helpers'
import {
  proposals,
  proposalPhases,
  proposalStaffing,
  clients,
  persons,
  rates,
  organizations,
} from '@/db/schema'
import { formatEur } from '@/lib/margin'
import PrintButton from './print-button'

// ─── Labels ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  head: 'Head',
  lead: 'Lead',
  senior: 'Senior',
  mid: 'Mid',
  junior: 'Junior',
  trainee: 'Trainee',
}

const AREA_LABELS: Record<string, string> = {
  research: 'Research',
  ux: 'UX',
  ui: 'UI',
}

const BILLING_LABELS: Record<string, string> = {
  hour_bag: 'Bolsa de horas',
  monthly_fee: 'Fee mensual',
  by_phase: 'Por entregable',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortDate(isoDate: string): string {
  const parts = isoDate.split('-')
  const y = parts[0]
  const m = Number(parts[1])
  const d = Number(parts[2])
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d} ${months[m - 1]} ${y}`
}

function rateFor(
  area: string,
  role: string,
  orgRates: Array<{ area: string; role: string; soldRateCents: number | null; workspaceId: string | null }>,
): number | null {
  const ws = orgRates.find((r) => r.area === area && r.role === role && r.workspaceId !== null)
  const base = orgRates.find((r) => r.area === area && r.role === role && r.workspaceId === null)
  return (ws ?? base)?.soldRateCents ?? null
}

// ─── Print styles ─────────────────────────────────────────────────────────────

const STYLES = `
  @media print {
    .no-print { display: none !important; }
    body { background: white !important; margin: 0; }
    .carta-page { box-shadow: none !important; margin: 0 !important; padding: 32px !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
  @media screen {
    body { background: #eef2fa; }
    .print-bar {
      position: sticky; top: 0; z-index: 100;
      background: #fff; border-bottom: 1px solid #dde1ec;
      padding: 12px 32px; display: flex; align-items: center; gap: 16px;
    }
    .carta-page {
      background: white; box-shadow: 0 1px 16px rgba(0,0,0,.07);
      margin: 32px auto; max-width: 820px; min-height: 900px;
    }
  }
  .carta-page {
    padding: 56px 64px;
    font-family: var(--font-dm-sans, 'DM Sans', sans-serif);
    color: #111; line-height: 1.6; font-size: 14px;
  }
  .section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: #9a9a9a;
    margin: 0 0 16px; padding-bottom: 8px;
    border-bottom: 1px solid #dde1ec;
  }
  .carta-table {
    width: 100%; border-collapse: collapse; font-size: 13px;
  }
  .carta-table th {
    text-align: left; font-weight: 600; font-size: 11px;
    color: #9a9a9a; padding: 6px 10px 6px 0;
    border-bottom: 1px solid #dde1ec; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .carta-table td {
    padding: 10px 10px 10px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top;
  }
  .carta-table .total-row td {
    border-top: 2px solid #111; border-bottom: none;
    font-weight: 700; padding-top: 12px;
  }
`

// ─── Page ─────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ id: string }> }

export default async function CartaOfertaPage({ params }: Props) {
  const { id } = await params
  const person = await requireRole('manager').catch(() => null)
  if (!person) redirect('/login')

  const today = new Date().toISOString().split('T')[0]!

  const [proposalRow, phases, staffingRows, orgRates] = await Promise.all([
    db
      .select({
        id: proposals.id,
        name: proposals.name,
        billingModel: proposals.billingModel,
        clientName: clients.name,
        orgName: organizations.name,
      })
      .from(proposals)
      .leftJoin(clients, eq(clients.id, proposals.clientId))
      .innerJoin(organizations, eq(organizations.id, proposals.organizationId))
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, person.organizationId)))
      .limit(1)
      .then((r) => r[0] ?? null),

    db
      .select()
      .from(proposalPhases)
      .where(
        and(
          eq(proposalPhases.proposalId, id),
          eq(proposalPhases.organizationId, person.organizationId),
        ),
      )
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
      .where(
        and(
          eq(proposalStaffing.proposalId, id),
          eq(proposalStaffing.organizationId, person.organizationId),
        ),
      ),

    db
      .select({
        area: rates.area,
        role: rates.role,
        soldRateCents: rates.soldRateCents,
        workspaceId: rates.workspaceId,
      })
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

  if (!proposalRow) notFound()

  // Build team lines
  const lines = staffingRows.map((s) => {
    const role =
      s.staffingType === 'person' ? (s.personCategory ?? 'mid') : (s.roleCategory ?? 'mid')
    const hours = parseFloat(s.estimatedHours)
    const soldRate = rateFor(s.area, role, orgRates)
    const label =
      s.personName
        ? `${s.personName}`
        : `${ROLE_LABELS[role] ?? role} · ${AREA_LABELS[s.area] ?? s.area}`
    return { label, area: s.area, hours, soldRateCents: soldRate }
  })

  const byPhase = proposalRow.billingModel === 'by_phase'

  const totalCents = byPhase
    ? phases.reduce(
        (acc, p) => acc + (p.billingAmount ? Math.round(parseFloat(p.billingAmount) * 100) : 0),
        0,
      )
    : lines.reduce(
        (acc, l) =>
          acc + (l.soldRateCents != null ? Math.round(l.soldRateCents * l.hours) : 0),
        0,
      )

  const totalHours = lines.reduce((acc, l) => acc + l.hours, 0)

  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* Print bar — hidden when printing */}
      <div className="print-bar no-print">
        <PrintButton />
        <a
          href={`/proposals/${id}`}
          style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}
        >
          ← Volver a la propuesta
        </a>
      </div>

      {/* Document */}
      <div className="carta-page">

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 48,
          }}
        >
          <div
            style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}
          >
            {proposalRow.orgName}
          </div>
          <div style={{ color: '#9a9a9a', fontSize: 13, textAlign: 'right' }}>
            <div>{dateStr}</div>
            {proposalRow.clientName && (
              <div style={{ marginTop: 4 }}>
                Para: <strong style={{ color: '#555' }}>{proposalRow.clientName}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Title block */}
        <div style={{ borderBottom: '2px solid #111', paddingBottom: 20, marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: '#9a9a9a',
              marginBottom: 10,
            }}
          >
            Propuesta de colaboración
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {proposalRow.name}
          </h1>
        </div>

        {/* Billing model badge */}
        <div
          style={{
            display: 'inline-block',
            background: '#eef2fa',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: '#555',
            marginBottom: 40,
          }}
        >
          {BILLING_LABELS[proposalRow.billingModel] ?? proposalRow.billingModel}
        </div>

        {/* Phases */}
        {phases.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 className="section-title">Fases del proyecto</h2>
            <table className="carta-table">
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Fecha de entrega</th>
                  {byPhase && <th style={{ textAlign: 'right' }}>Inversión</th>}
                </tr>
              </thead>
              <tbody>
                {phases.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td style={{ color: '#555' }}>
                      {p.deliveryDate ? shortDate(p.deliveryDate) : '—'}
                    </td>
                    {byPhase && (
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {p.billingAmount
                          ? formatEur(Math.round(parseFloat(p.billingAmount) * 100))
                          : '—'}
                      </td>
                    )}
                  </tr>
                ))}
                {byPhase && (
                  <tr className="total-row">
                    <td colSpan={2}>Total</td>
                    <td style={{ textAlign: 'right' }}>
                      {totalCents > 0 ? formatEur(totalCents) : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* Team */}
        {lines.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <h2 className="section-title">Composición del equipo</h2>
            <table className="carta-table">
              <thead>
                <tr>
                  <th>Perfil</th>
                  <th>Área</th>
                  <th style={{ textAlign: 'right' }}>Horas est.</th>
                  {!byPhase && <th style={{ textAlign: 'right' }}>Tarifa/h</th>}
                  {!byPhase && <th style={{ textAlign: 'right' }}>Total</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{l.label}</td>
                    <td style={{ color: '#555' }}>{AREA_LABELS[l.area] ?? l.area}</td>
                    <td style={{ textAlign: 'right', color: '#555' }}>{l.hours}h</td>
                    {!byPhase && (
                      <td style={{ textAlign: 'right', color: '#555' }}>
                        {l.soldRateCents != null ? `${formatEur(l.soldRateCents)}/h` : '—'}
                      </td>
                    )}
                    {!byPhase && (
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {l.soldRateCents != null
                          ? formatEur(Math.round(l.soldRateCents * l.hours))
                          : '—'}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={byPhase ? 2 : 2}>Total</td>
                  <td style={{ textAlign: 'right' }}>{totalHours}h</td>
                  {!byPhase && <td />}
                  {!byPhase && (
                    <td style={{ textAlign: 'right' }}>
                      {totalCents > 0 ? formatEur(totalCents) : '—'}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* Investment summary */}
        <div
          style={{
            marginBottom: 56,
            padding: '24px 28px',
            background: '#f8f9fc',
            borderRadius: 10,
            borderLeft: '4px solid #111',
          }}
        >
          <div style={{ fontSize: 11, color: '#9a9a9a', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Inversión total estimada
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>
            {totalCents > 0 ? formatEur(totalCents) : 'A determinar'}
          </div>
          <div style={{ fontSize: 12, color: '#9a9a9a', marginTop: 4 }}>
            Precios sin IVA
          </div>
        </div>

        {/* Conditions */}
        <section style={{ marginBottom: 64 }}>
          <h2 className="section-title">Condiciones</h2>
          <ul style={{ color: '#555', lineHeight: 2.2, paddingLeft: 18, margin: 0, fontSize: 13 }}>
            <li>Validez de la propuesta: 30 días naturales desde la fecha de emisión.</li>
            <li>Precios indicados sin IVA. Se aplicará el tipo vigente en el momento de la facturación.</li>
            <li>Las condiciones de pago y plazos quedarán especificados en el contrato correspondiente.</li>
            <li>Las horas estimadas pueden ajustarse en función del alcance final acordado.</li>
          </ul>
        </section>

        {/* Signature block */}
        <div
          style={{
            paddingTop: 24,
            borderTop: '1px solid #dde1ec',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 32,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{proposalRow.orgName}</div>
            <div style={{ color: '#9a9a9a', fontSize: 12 }}>Firma autorizada</div>
            <div
              style={{
                marginTop: 48,
                borderTop: '1px solid #ccc',
                paddingTop: 6,
                width: 220,
                color: '#9a9a9a',
                fontSize: 11,
              }}
            >
              Nombre, fecha y firma
            </div>
          </div>
          {proposalRow.clientName && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{proposalRow.clientName}</div>
              <div style={{ color: '#9a9a9a', fontSize: 12 }}>Aceptación del cliente</div>
              <div
                style={{
                  marginTop: 48,
                  borderTop: '1px solid #ccc',
                  paddingTop: 6,
                  width: 220,
                  color: '#9a9a9a',
                  fontSize: 11,
                }}
              >
                Nombre, fecha y firma
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            color: '#ccc',
            fontSize: 10,
            textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          Documento generado con Houra · {proposalRow.orgName}
        </div>
      </div>
    </>
  )
}
