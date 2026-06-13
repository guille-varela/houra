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

// ─── Constantes corporativas Globant GUT (plantilla oficial F2.14) ─────────────
// Multi-org en el futuro (F3.3): hoy Houra es la herramienta interna de Gut, así
// que los datos fiscales y de marca son constantes de Gut.

const GUT = {
  legalName: 'Software Product Creation SL',
  cif: 'B 85677672',
  fiscalAddress: 'Claudio Coello, 46, 2 izq. 28001, Madrid',
  contactName: 'Francisco García Franco',
  network: 'globant-gut-network',
  email: 'globant-gut-network@globant.com',
  phone: '+34 915 319 021',
  footerAddress: 'Cristóbal Bordiú, 13, 28003 - Madrid, España',
}

const OUT_OF_SCOPE_NOTE =
  'El presente presupuesto no cubre actividades o servicios adicionales que puedan surgir fuera del alcance del proyecto acordado. Cualquier trabajo adicional requerirá una evaluación y cotización por separado, sujeto a la aprobación mutua de ambas partes.'

const BILLING_CONDITIONS = [
  'Se realizará el 50% al inicio del proyecto y el 50% restante al final.',
  'La presente propuesta comercial tiene una validez de 30 días naturales desde su presentación.',
  'Todos los importes especificados son en euros (€) y sin IVA; se aplicará el tipo vigente en el momento de la facturación.',
  'La divisa para el cobro del proyecto será el euro (€).',
]

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

function monthYear(date: Date): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  const m = months[date.getMonth()]
  return `${m}, ${date.getFullYear()}`
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
  @page { size: A4; margin: 0; }
  @media print {
    .no-print { display: none !important; }
    body { background: white !important; margin: 0; }
    .carta-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
    .carta-page:last-child { page-break-after: auto; }
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
      box-shadow: 0 1px 16px rgba(0,0,0,.07);
      margin: 32px auto;
    }
  }
  .carta-page {
    position: relative;
    box-sizing: border-box;
    background: white;
    width: 210mm;
    min-height: 297mm;
    padding: 28mm 24mm 24mm;
    display: flex;
    flex-direction: column;
    font-family: var(--font-dm-sans, 'DM Sans', system-ui, sans-serif);
    color: #1a1a1a; line-height: 1.6; font-size: 13.5px;
  }
  .carta-body { flex: 1; }
  .gut-wordmark {
    position: absolute; top: 14mm; right: 24mm;
    font-weight: 700; font-size: 17px; letter-spacing: -0.01em; color: #111;
    display: flex; align-items: center; gap: 5px;
  }
  .gut-wordmark .chev { color: #111; font-size: 13px; transform: translateY(0.5px); }
  .gut-wordmark .gut { font-family: Georgia, 'Times New Roman', serif; font-style: normal; }
  .carta-foot {
    margin-top: 24px; padding-top: 10px;
    text-align: center; color: #b0b4c0; font-size: 9.5px; line-height: 1.5;
  }
  .serif-h {
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic; font-weight: 400; color: #111;
    letter-spacing: -0.01em;
  }
  .section-num { font-size: 26px; margin: 0 0 20px; }
  .eyebrow {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.12em; color: #8a8f9c;
  }
  .field-label { color: #8a8f9c; font-size: 12.5px; margin-bottom: 4px; }
  .carta-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .carta-table th {
    text-align: left; font-weight: 700; font-size: 11px;
    color: #6b7280; padding: 8px 10px; background: #f6f7fb;
    border: 1px solid #e4e7ef; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .carta-table td { padding: 9px 10px; border: 1px solid #eef0f5; vertical-align: top; }
  .carta-table .total-row td {
    border-top: 2px solid #111; font-weight: 700; padding-top: 11px; background: #fff;
  }
  .toc-list { list-style: none; padding: 0; margin: 24px 0 0; }
  .toc-list li { padding: 12px 0; border-bottom: 1px solid #eef0f5; font-size: 15px; }
  .toc-list .toc-sub { padding-left: 28px; font-size: 14px; color: #555; }
  .toc-list .toc-n { color: #2563eb; font-weight: 600; margin-right: 10px; }
`

// ─── Sub-componentes de presentación ───────────────────────────────────────────

function Wordmark() {
  return (
    <div className="gut-wordmark">
      <span>Globant</span>
      <span className="chev">❯</span>
      <span className="gut">gut</span>
    </div>
  )
}

function Foot() {
  return (
    <div className="carta-foot">
      <div>{GUT.network} | {GUT.email} | {GUT.phone}</div>
      <div>{GUT.footerAddress}</div>
    </div>
  )
}

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

  // Líneas de equipo (sin exponer tarifas internas en el documento de cliente)
  const lines = staffingRows.map((s) => {
    const role =
      s.staffingType === 'person' ? (s.personCategory ?? 'mid') : (s.roleCategory ?? 'mid')
    const hours = parseFloat(s.estimatedHours)
    const soldRate = rateFor(s.area, role, orgRates)
    const label = s.personName
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
        (acc, l) => acc + (l.soldRateCents != null ? Math.round(l.soldRateCents * l.hours) : 0),
        0,
      )

  const totalHours = lines.reduce((acc, l) => acc + l.hours, 0)
  const now = new Date()
  const hasScope = phases.length > 0 || lines.length > 0

  // Numeración dinámica del índice según las secciones que se incluyen
  const sections: string[] = ['Datos generales y de contacto']
  if (hasScope) sections.push('Alcance y entregables')
  sections.push('Presupuesto total')
  sections.push('Condiciones de facturación')
  const numOf = (title: string) => sections.indexOf(title) + 1

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* Barra de acciones — oculta al imprimir */}
      <div className="print-bar no-print">
        <PrintButton />
        <a
          href={`/proposals/${id}`}
          style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}
        >
          ← Volver a la propuesta
        </a>
      </div>

      {/* ── Página 1 · Portada ── */}
      <div className="carta-page">
        <Wordmark />
        <div className="carta-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Propuesta de colaboración</div>
          <div style={{ fontSize: 15, color: '#555', marginBottom: 22 }}>Globant GUT:</div>
          <h1 className="serif-h" style={{ fontSize: 42, lineHeight: 1.15, margin: 0 }}>
            {proposalRow.name}
          </h1>
          {proposalRow.clientName && (
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6 }}>
              {proposalRow.clientName}
            </div>
          )}
          <div style={{ fontSize: 14, color: '#555', marginTop: 40 }}>{monthYear(now)}</div>
        </div>
        <Foot />
      </div>

      {/* ── Página 2 · Índice ── */}
      <div className="carta-page">
        <Wordmark />
        <div className="carta-body">
          <h2 className="serif-h section-num">Índice</h2>
          <ul className="toc-list">
            {sections.map((title, i) => (
              <li key={title}>
                <span className="toc-n">{i + 1}.</span>{title}
              </li>
            ))}
          </ul>
        </div>
        <Foot />
      </div>

      {/* ── Página 3 · Datos generales y de contacto ── */}
      <div className="carta-page">
        <Wordmark />
        <div className="carta-body">
          <h2 className="serif-h section-num">{numOf('Datos generales y de contacto')}. Datos generales y de contacto</h2>

          <div style={{ fontWeight: 700, fontSize: 16, borderBottom: '1px solid #111', display: 'inline-block', paddingBottom: 2, marginBottom: 24 }}>
            Globant GUT
          </div>

          <div className="field-label">Información de contacto</div>
          <ul style={{ margin: '0 0 28px', paddingLeft: 18 }}>
            <li>{GUT.contactName}</li>
          </ul>

          <div className="field-label">Datos fiscales</div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
            <li>Nombre de empresa: <strong>{GUT.legalName}</strong></li>
            <li>CIF: <strong>{GUT.cif}</strong></li>
            <li><strong>{GUT.fiscalAddress}</strong></li>
          </ul>
        </div>
        <Foot />
      </div>

      {/* ── Página 4 · Alcance y entregables (si hay scope) ── */}
      {hasScope && (
        <div className="carta-page">
          <Wordmark />
          <div className="carta-body">
            <h2 className="serif-h section-num">{numOf('Alcance y entregables')}. Alcance y entregables</h2>

            {phases.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <div className="eyebrow" style={{ marginBottom: 14 }}>Fases y entregables</div>
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
                        <td style={{ color: '#555' }}>{p.deliveryDate ? shortDate(p.deliveryDate) : '—'}</td>
                        {byPhase && (
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>
                            {p.billingAmount ? formatEur(Math.round(parseFloat(p.billingAmount) * 100)) : '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                    {byPhase && (
                      <tr className="total-row">
                        <td colSpan={2}>Total</td>
                        <td style={{ textAlign: 'right' }}>{totalCents > 0 ? formatEur(totalCents) : '—'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {lines.length > 0 && (
              <section style={{ marginBottom: 32 }}>
                <div className="eyebrow" style={{ marginBottom: 14 }}>Equipo estimado</div>
                <table className="carta-table">
                  <thead>
                    <tr>
                      <th>Perfil</th>
                      <th>Área</th>
                      <th style={{ textAlign: 'right' }}>Horas estimadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{l.label}</td>
                        <td style={{ color: '#555' }}>{AREA_LABELS[l.area] ?? l.area}</td>
                        <td style={{ textAlign: 'right', color: '#555' }}>{l.hours}h</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={2}>Total</td>
                      <td style={{ textAlign: 'right' }}>{totalHours}h</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )}

            <section>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Fuera de alcance</div>
              <p style={{ color: '#555', margin: 0 }}>{OUT_OF_SCOPE_NOTE}</p>
            </section>
          </div>
          <Foot />
        </div>
      )}

      {/* ── Página 5 · Presupuesto total + Condiciones de facturación ── */}
      <div className="carta-page">
        <Wordmark />
        <div className="carta-body">
          <h2 className="serif-h section-num">{numOf('Presupuesto total')}. Presupuesto total</h2>

          <div
            style={{
              marginBottom: 16,
              padding: '24px 28px',
              background: '#f8f9fc',
              borderRadius: 10,
              borderLeft: '4px solid #111',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 6 }}>Inversión total estimada</div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em' }}>
              {totalCents > 0 ? formatEur(totalCents) : 'A determinar'}
            </div>
            <div style={{ fontSize: 12, color: '#8a8f9c', marginTop: 4 }}>
              {BILLING_LABELS[proposalRow.billingModel] ?? proposalRow.billingModel}
              {totalHours > 0 ? ` · ${totalHours}h estimadas` : ''} · Precios sin IVA
            </div>
          </div>

          <h2 className="serif-h section-num" style={{ marginTop: 44 }}>
            {numOf('Condiciones de facturación')}. Condiciones de facturación
          </h2>
          <ol style={{ color: '#444', lineHeight: 2.1, paddingLeft: 20, margin: 0 }}>
            {BILLING_CONDITIONS.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>

          {/* Firmas */}
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #e4e7ef', display: 'flex', justifyContent: 'space-between', gap: 32 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Globant GUT</div>
              <div style={{ color: '#8a8f9c', fontSize: 12 }}>Firma autorizada</div>
              <div style={{ marginTop: 44, borderTop: '1px solid #ccc', paddingTop: 6, width: 200, color: '#8a8f9c', fontSize: 11 }}>
                Nombre, fecha y firma
              </div>
            </div>
            {proposalRow.clientName && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{proposalRow.clientName}</div>
                <div style={{ color: '#8a8f9c', fontSize: 12 }}>Aceptación del cliente</div>
                <div style={{ marginTop: 44, borderTop: '1px solid #ccc', paddingTop: 6, width: 200, color: '#8a8f9c', fontSize: 11 }}>
                  Nombre, fecha y firma
                </div>
              </div>
            )}
          </div>
        </div>
        <Foot />
      </div>
    </>
  )
}
