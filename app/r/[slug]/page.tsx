import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { Stack, Container, Text, Title } from '@mantine/core'
import { db } from '@/lib/db'
import { organizations, reports } from '@/db/schema'
import { verifyReportToken } from '@/lib/report-auth'
import { getCartaOfertaData } from '@/lib/carta-oferta-data'
import CartaOfertaDocument from '@/app/(print)/proposals/[id]/carta-oferta/carta-document'
import PrintButton from '@/app/(print)/proposals/[id]/carta-oferta/print-button'
import PasswordForm from './password-form'
import ReportView from './report-view'

type Props = { params: Promise<{ slug: string }> }

export default async function PublicReportPage({ params }: Props) {
  const { slug } = await params

  const [report] = await db
    .select({
      id: reports.id,
      scope: reports.scope,
      scopeId: reports.scopeId,
      passwordHash: reports.passwordHash,
      status: reports.status,
      expiresAt: reports.expiresAt,
      organizationId: reports.organizationId,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.shareUrlSlug, slug))
    .limit(1)

  if (!report) notFound()

  if (report.status === 'closed') {
    return (
      <Container size="sm" py="xl">
        <Stack align="center" gap="xs">
          <Title order={4}>Informe no disponible</Title>
          <Text c="dimmed" size="sm">Este informe ya no está disponible. Contacta con quien te lo compartió.</Text>
        </Stack>
      </Container>
    )
  }

  if (report.expiresAt && report.expiresAt < new Date()) {
    return (
      <Container size="sm" py="xl">
        <Stack align="center" gap="xs">
          <Title order={4}>Enlace caducado</Title>
          <Text c="dimmed" size="sm">El enlace de acceso ha expirado. Pide un nuevo enlace a quien te lo envió.</Text>
        </Stack>
      </Container>
    )
  }

  // Determine if password is required
  let requiredHash = report.passwordHash
  let orgName = 'Houra'

  const [org] = await db
    .select({ name: organizations.name, reportDefaultPasswordHash: organizations.reportDefaultPasswordHash })
    .from(organizations)
    .where(eq(organizations.id, report.organizationId))
    .limit(1)

  if (org) {
    orgName = org.name
    if (!requiredHash) requiredHash = org.reportDefaultPasswordHash
  }

  const passwordRequired = requiredHash !== null

  if (passwordRequired) {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get(`rp_${slug}`)?.value
    const authenticated = tokenCookie ? await verifyReportToken(slug, tokenCookie) : false

    if (!authenticated) {
      return <PasswordForm slug={slug} orgName={orgName} />
    }
  }

  // Carta oferta (F2.13): documento a pantalla completa, fuera del Container
  if (report.scope === 'proposal') {
    const data = await getCartaOfertaData(report.scopeId, report.organizationId)
    if (!data) notFound()
    return (
      <>
        <div className="print-bar no-print">
          <PrintButton />
        </div>
        <CartaOfertaDocument data={data} />
      </>
    )
  }

  return (
    <Container size="md" py="xl">
      <ReportView
        scope={report.scope}
        scopeId={report.scopeId}
        generatedAt={report.createdAt.toISOString()}
      />
    </Container>
  )
}
