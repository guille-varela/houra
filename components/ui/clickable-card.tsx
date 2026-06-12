'use client'

import { useRouter } from 'next/navigation'
import { Card, type CardProps } from '@mantine/core'

type Props = CardProps & {
  /** Ruta a la que navega la card al hacer clic */
  href: string
  children: React.ReactNode
}

/**
 * Card navegable: toda la superficie es clicable y lleva a `href`.
 * Accesible (role link + foco por teclado con Enter/Space) y con hover
 * de elevación (clase `h-clickable-card` en globals.css). Las sub-acciones
 * internas deben llamar a `e.stopPropagation()` para no disparar la navegación.
 */
export function ClickableCard({ href, children, className, style, ...cardProps }: Props) {
  const router = useRouter()
  const go = () => router.push(href)

  return (
    <Card
      {...cardProps}
      className={`h-clickable-card${className ? ` ${className}` : ''}`}
      style={{ cursor: 'pointer', ...style }}
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          go()
        }
      }}
    >
      {children}
    </Card>
  )
}
