'use client'

import Link from 'next/link'
import { Anchor, type AnchorProps } from '@mantine/core'

/** Propiedades del componente AnchorLink */
type Props = AnchorProps & {
  /** Ruta de destino del enlace */
  href: string
  /** Contenido del enlace */
  children?: React.ReactNode
  /** Handler de clic opcional, útil para prevenir propagación en cards clicables */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}

/** Enlace de Mantine integrado con next/link para navegación client-side estilizada */
export function AnchorLink({ href, children, ...props }: Props) {
  return (
    <Anchor component={Link} href={href} {...props}>
      {children}
    </Anchor>
  )
}
