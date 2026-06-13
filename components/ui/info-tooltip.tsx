'use client'

import { Tooltip, ActionIcon, type FloatingPosition } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import type { ReactNode } from 'react'

/** Propiedades del InfoTooltip */
type Props = {
  /** Contenido del tooltip: texto explicativo o fórmula del cálculo */
  label: ReactNode
  /** Posición relativa del tooltip respecto al icono */
  position?: FloatingPosition
  /** Tamaño del icono en px */
  size?: number
  /** Etiqueta accesible del botón (por defecto "Más información") */
  ariaLabel?: string
}

/**
 * Icono `i` reutilizable que abre un tooltip explicativo al hover o al focus.
 * Accesible por teclado (es un ActionIcon enfocable). Pensado para explicar
 * KPIs, fórmulas y valores ambiguos de forma consistente en todo el producto.
 */
export default function InfoTooltip({
  label,
  position = 'top',
  size = 14,
  ariaLabel = 'Más información',
}: Props) {
  return (
    <Tooltip
      label={label}
      position={position}
      withArrow
      multiline
      w={260}
      events={{ hover: true, focus: true, touch: true }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        radius="xl"
        aria-label={ariaLabel}
        style={{ verticalAlign: 'middle' }}
      >
        <IconInfoCircle size={size} />
      </ActionIcon>
    </Tooltip>
  )
}
