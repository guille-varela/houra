'use client'

import { useState } from 'react'
import { Table, Text, Box, Badge, Group, Tooltip } from '@mantine/core'
import { AREAS, ROLES, AREA_LABELS, ROLE_LABELS, type MatrixCell } from '@/lib/matrix'
import CellDetailSheet from './cell-detail-sheet'

const CELL_COLOR: Record<MatrixCell['color'], string> = {
  green: 'var(--mantine-color-green-6)',
  orange: 'var(--mantine-color-orange-6)',
  red: 'var(--mantine-color-red-6)',
  empty: 'var(--mantine-color-gray-3)',
}

const BADGE_COLOR: Record<MatrixCell['color'], string> = {
  green: 'green',
  orange: 'orange',
  red: 'red',
  empty: 'gray',
}

type Props = {
  matrix: MatrixCell[][]
  projectId: string
}

export default function AllocationMatrix({ matrix, projectId }: Props) {
  const [selected, setSelected] = useState<MatrixCell | null>(null)

  const cellMap = new Map<string, MatrixCell>()
  for (const row of matrix) {
    for (const cell of row) {
      cellMap.set(`${cell.area}:${cell.role}`, cell)
    }
  }

  return (
    <>
      <Box style={{ overflowX: 'auto' }}>
        <Table withTableBorder withColumnBorders fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 90 }}></Table.Th>
              {ROLES.map((role) => (
                <Table.Th key={role} ta="center" style={{ minWidth: 110 }}>
                  {ROLE_LABELS[role]}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {AREAS.map((area) => (
              <Table.Tr key={area}>
                <Table.Td fw={500}>{AREA_LABELS[area]}</Table.Td>
                {ROLES.map((role) => {
                  const cell = cellMap.get(`${area}:${role}`)
                  if (!cell) return <Table.Td key={role} />
                  const isEmpty = cell.color === 'empty'

                  return (
                    <Table.Td
                      key={role}
                      ta="center"
                      style={{ cursor: isEmpty ? 'default' : 'pointer' }}
                      onClick={() => !isEmpty && setSelected(cell)}
                    >
                      {isEmpty ? (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      ) : (
                        <Tooltip
                          label={
                            cell.planned > 0
                              ? `${cell.consumed.toFixed(1)}h / ${cell.planned}h`
                              : `${cell.consumed.toFixed(1)}h sin planificar`
                          }
                          withArrow
                        >
                          <Group justify="center" gap={4}>
                            <Badge
                              size="sm"
                              color={BADGE_COLOR[cell.color]}
                              variant="light"
                              style={{ cursor: 'pointer' }}
                            >
                              {cell.pct !== null ? `${Math.round(cell.pct)}%` : `${cell.consumed.toFixed(1)}h`}
                            </Badge>
                          </Group>
                        </Tooltip>
                      )}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      <Group gap="xs" mt="xs">
        {(['green', 'orange', 'red'] as const).map((c) => (
          <Group key={c} gap={4}>
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: CELL_COLOR[c],
              }}
            />
            <Text size="xs" c="dimmed">
              {c === 'green' ? '<80%' : c === 'orange' ? '80–99%' : '≥100%'}
            </Text>
          </Group>
        ))}
      </Group>

      {selected && (
        <CellDetailSheet
          cell={selected}
          projectId={projectId}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
