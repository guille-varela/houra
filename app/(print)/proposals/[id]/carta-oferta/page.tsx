import { notFound, redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth-helpers'
import { getCartaOfertaData } from '@/lib/carta-oferta-data'
import CartaOfertaDocument from './carta-document'
import CartaShareButton from './carta-share-button'
import PrintButton from './print-button'

type Props = { params: Promise<{ id: string }> }

export default async function CartaOfertaPage({ params }: Props) {
  const { id } = await params
  const person = await requireRole('manager').catch(() => null)
  if (!person) redirect('/login')

  const data = await getCartaOfertaData(id, person.organizationId)
  if (!data) notFound()

  return (
    <>
      <div className="print-bar no-print">
        <PrintButton />
        <CartaShareButton proposalId={id} />
        <a href={`/proposals/${id}`} style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>
          ← Volver a la propuesta
        </a>
      </div>

      <CartaOfertaDocument data={data} />
    </>
  )
}
