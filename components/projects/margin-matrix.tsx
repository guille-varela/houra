'use client'

import { Group, Text, Tooltip, SimpleGrid, Box, Badge } from '@mantine/core'
import { AREAS, ROLES, AREA_LABELS, ROLE_LABELS } from '@/lib/matrix'
import { type MarginCell, formatEur } from '@/lib/margin'
import { marginColor } from '@/lib/tokens'

/** Propiedades del componente MarginMatrix */
type Props = {
  /** Matriz bidimensional de celdas de margen, indexada por área y rol */
  matrix: MarginCell[][]
}

/** Grid de margen económico por área y rol, con código de colores y tooltip de detalle financiero */
export default function MarginMatrix({ matrix }: Props) {
  const cols = ROLES.length + 1
  const colWidth = 90

  return (
    <Box style={{ overflowX: 'auto' }}>
      <SimpleGrid cols={cols} spacing={2} style={{ minWidth: cols * colWidth }}>
        {/* Header row */}
        <Box />
        {ROLES.map((role) => (
          <Text key={role} size="xs" fw={600} ta="center" c="dimmed">
            {ROLE_LABELS[role]}
          </Text>
        ))}

        {/* Data rows */}
        {AREAS.map((area, areaIdx) =>
          [
            <Text key={`label-${area}`} size="xs" fw={600} style={{ display: 'flex', alignItems: 'center' }}>
              {AREA_LABELS[area]}
            </Text>,
            ...ROLES.map((role, roleIdx) => {
              const cell = matrix[areaIdx]?.[roleIdx]
              if (!cell || cell.hours === 0) {
                return (
                  <Box
                    key={`${area}-${role}`}
                    style={{
                      height: 56,
                      borderRadius: 4,
                      background: 'var(--mantine-color-gray-1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text size="xs" c="dimmed">—</Text>
                  </Box>
                )
              }

              const color = marginColor(cell.marginPct ?? -1)
              const pctDisplay =
                cell.marginPct !== null ? `${cell.marginPct.toFixed(1)}%` : 'n/d'

              return (
                <Tooltip
                  key={`${area}-${role}`}
                  label={
                    <Box>
                      <Text size="xs">{formatEur(cell.soldCents)} vendido</Text>
                      <Text size="xs">{formatEur(cell.costCents)} coste</Text>
                      <Text size="xs">{cell.hours.toFixed(1)}h imputadas</Text>
                    </Box>
                  }
                  withArrow
                >
                  <Box
                    style={{
                      height: 56,
                      borderRadius: 4,
                      cursor: 'default',
                      background: `var(--mantine-color-${color}-0)`,
                      border: `1px solid var(--mantine-color-${color}-3)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                    }}
                  >
                    <Badge
                      size="sm"
                      color={color}
                      variant="light"
                      style={{ pointerEvents: 'none' }}
                    >
                      {pctDisplay}
                    </Badge>
                    <Text size="xs" c="dimmed" style={{ lineHeight: 1 }}>
                      {formatEur(cell.marginCents)}
                    </Text>
                  </Box>
                </Tooltip>
              )
            }),
          ]
        )}
      </SimpleGrid>

      <Group gap="xs" mt="sm">
        {[
          { color: 'green', label: '≥ 20%' },
          { color: 'yellow', label: '5–20%' },
          { color: 'orange', label: '0–5%' },
          { color: 'red', label: '< 0%' },
        ].map(({ color, label }) => (
          <Group key={color} gap={4}>
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: `var(--mantine-color-${color}-5)`,
              }}
            />
            <Text size="xs" c="dimmed">{label}</Text>
          </Group>
        ))}
      </Group>
    </Box>
  )
}
