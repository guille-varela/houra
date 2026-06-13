'use client'

import Link from 'next/link'
import { Group, Text } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'

/** Propiedades del BackLink */
type Props = {
  /** Ruta del listado o pantalla padre a la que vuelve */
  href: string
  /** Texto del enlace (por defecto "Volver") */
  label?: string
}

/**
 * Enlace canónico "volver" para cabeceras de pantallas de detalle.
 * Siempre va en la esquina superior izquierda del scope, encima del título.
 * El CTA principal de la pantalla va a la derecha (patrón F2.16).
 */
export default function BackLink({ href, label = 'Volver' }: Props) {
  return (
    <Text
      component={Link}
      href={href}
      size="xs"
      c="dimmed"
      style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}
    >
      <Group gap={4} align="center" wrap="nowrap">
        <IconArrowLeft size={14} />
        {label}
      </Group>
    </Text>
  )
}
