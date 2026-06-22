'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Group, Select, Text, Tooltip, ActionIcon, Loader, Badge, Button } from '@mantine/core'
import { IconArrowsExchange, IconDownload } from '@tabler/icons-react'
import { formatEur } from '@/lib/margin'
import { marginColor } from '@/lib/tokens'
import type { PivotResult } from '@/lib/insights-data'
import { pivotToCsv, pivotCsvFilename } from '@/lib/insights-export'
import {
  type InsightsFilters,
  type PivotDim,
  type PivotCol,
  type PivotMetric,
  PIVOT_DIMENSIONS,
  PIVOT_DIM_LABELS,
  PIVOT_METRICS,
  PIVOT_METRIC_LABELS,
  buildInsightsQuery,
} from '@/lib/insights-filters'

type Props = {
  pivot: PivotResult
  filters: InsightsFilters
}

function fmtMetric(v: number | null, metric: PivotMetric): string {
  if (v === null) return '—'
  if (metric === 'hours') return `${Math.round(v).toLocaleString('es-ES')} h`
  if (metric === 'margin') return `${v.toFixed(1)}%`
  return formatEur(v) // revenue | cost (en céntimos)
}

// Fondo tonal solo para la métrica de margen (semáforo); el resto se deja plano.
function cellBg(v: number | null, metric: PivotMetric): string | undefined {
  if (metric !== 'margin' || v === null) return undefined
  return `var(--mantine-color-${marginColor(v)}-light)`
}

export default function PivotTable({ pivot, filters }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function apply(next: Partial<InsightsFilters>) {
    const qs = buildInsightsQuery({ ...filters, ...next })
    startTransition(() => router.push(qs ? `/insights?${qs}` : '/insights'))
  }

  // Cambiar la dimensión de filas; si coincide con la de columnas, colapsa columnas.
  function setRow(v: PivotDim) {
    apply(v === filters.pivotCol ? { pivotRow: v, pivotCol: 'none' } : { pivotRow: v })
  }
  function setCol(v: PivotCol) {
    apply(v !== 'none' && v === filters.pivotRow ? { pivotCol: 'none' } : { pivotCol: v })
  }
  function transpose() {
    if (filters.pivotCol === 'none') return
    apply({ pivotRow: filters.pivotCol, pivotCol: filters.pivotRow })
  }

  // Descarga CSV de la tabla actual (cliente puro: los datos ya están en props).
  function exportCsv() {
    const csv = pivotToCsv(pivot)
    const isoDate = new Date().toISOString().slice(0, 10)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = pivotCsvFilename(pivot, isoDate)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const rowData = PIVOT_DIMENSIONS.map((d) => ({ value: d, label: PIVOT_DIM_LABELS[d] }))
  const colData: Array<{ value: string; label: string }> = [
    { value: 'none', label: 'Sin columnas (total)' },
    ...PIVOT_DIMENSIONS.map((d) => ({ value: d, label: PIVOT_DIM_LABELS[d] })),
  ]
  const metricData = PIVOT_METRICS.map((m) => ({ value: m, label: PIVOT_METRIC_LABELS[m] }))

  const hasCols = pivot.colDim !== 'none'
  const metricLabel = PIVOT_METRIC_LABELS[pivot.metric]

  const cellNumStyle: React.CSSProperties = {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    padding: '4px 10px',
    fontSize: 13,
    whiteSpace: 'nowrap',
  }
  const stickyFirst: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    background: 'var(--mantine-color-body)',
    zIndex: 1,
  }

  return (
    <Card p="md" withBorder>
      <Group justify="space-between" align="flex-end" mb="sm" wrap="wrap">
        <div>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            Tabla pivote
          </Text>
          <Text size="xs" c="dimmed">
            Cruza dos dimensiones cualesquiera con la métrica que elijas.
          </Text>
        </div>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <Select
            label="Filas"
            data={rowData}
            value={filters.pivotRow}
            onChange={(v) => v && setRow(v as PivotDim)}
            allowDeselect={false}
            w={140}
            size="xs"
          />
          <Tooltip label="Transponer (intercambiar filas y columnas)" disabled={!hasCols}>
            <ActionIcon
              variant="default"
              size="lg"
              onClick={transpose}
              disabled={!hasCols}
              aria-label="Transponer"
            >
              <IconArrowsExchange size={16} />
            </ActionIcon>
          </Tooltip>
          <Select
            label="Columnas"
            data={colData}
            value={filters.pivotCol}
            onChange={(v) => v && setCol(v as PivotCol)}
            allowDeselect={false}
            w={180}
            size="xs"
          />
          <Select
            label="Métrica"
            data={metricData}
            value={filters.pivotMetric}
            onChange={(v) => v && apply({ pivotMetric: v as PivotMetric })}
            allowDeselect={false}
            w={130}
            size="xs"
          />
          <Button
            variant="default"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={exportCsv}
            disabled={pivot.rows.length === 0}
          >
            Exportar CSV
          </Button>
          {isPending && <Loader size="xs" />}
        </Group>
      </Group>

      {pivot.rows.length === 0 ? (
        <Text size="sm" c="dimmed" py="lg" ta="center">
          Sin datos para los filtros seleccionados.
        </Text>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: hasCols ? 520 : 280 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                <th style={{ ...stickyFirst, textAlign: 'left', padding: '4px 10px' }}>
                  <Text size="xs" c="dimmed" fw={600}>
                    {PIVOT_DIM_LABELS[pivot.rowDim]}
                  </Text>
                </th>
                {hasCols ? (
                  pivot.colHeaders.map((c) => (
                    <th key={c.key} style={cellNumStyle}>
                      <Text size="xs" c="dimmed" fw={600} style={{ textAlign: 'right' }}>
                        {c.label}
                      </Text>
                    </th>
                  ))
                ) : (
                  <th style={cellNumStyle}>
                    <Text size="xs" c="dimmed" fw={600} style={{ textAlign: 'right' }}>
                      {metricLabel}
                    </Text>
                  </th>
                )}
                {hasCols && (
                  <th style={{ ...cellNumStyle, borderLeft: '1px solid var(--mantine-color-gray-2)' }}>
                    <Text size="xs" c="dimmed" fw={700} style={{ textAlign: 'right' }}>
                      Total
                    </Text>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((r) => (
                <tr key={r.key} style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
                  <td style={{ ...stickyFirst, textAlign: 'left', padding: '4px 10px' }}>
                    <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
                      {r.label}
                    </Text>
                  </td>
                  {hasCols ? (
                    r.cells.map((v, i) => (
                      <td key={i} style={{ ...cellNumStyle, background: cellBg(v, pivot.metric) }}>
                        {fmtMetric(v, pivot.metric)}
                      </td>
                    ))
                  ) : (
                    <td style={{ ...cellNumStyle, background: cellBg(r.total, pivot.metric) }}>
                      {fmtMetric(r.total, pivot.metric)}
                    </td>
                  )}
                  {hasCols && (
                    <td
                      style={{
                        ...cellNumStyle,
                        fontWeight: 600,
                        borderLeft: '1px solid var(--mantine-color-gray-2)',
                      }}
                    >
                      {fmtMetric(r.total, pivot.metric)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--mantine-color-gray-3)' }}>
                <td style={{ ...stickyFirst, textAlign: 'left', padding: '6px 10px' }}>
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: '0.04em' }}>
                    Total
                  </Text>
                </td>
                {hasCols ? (
                  pivot.colTotals.map((v, i) => (
                    <td key={i} style={{ ...cellNumStyle, fontWeight: 600 }}>
                      {fmtMetric(v, pivot.metric)}
                    </td>
                  ))
                ) : (
                  <td style={{ ...cellNumStyle, fontWeight: 700 }}>
                    {fmtMetric(pivot.grandTotal, pivot.metric)}
                  </td>
                )}
                {hasCols && (
                  <td
                    style={{
                      ...cellNumStyle,
                      fontWeight: 700,
                      borderLeft: '1px solid var(--mantine-color-gray-2)',
                    }}
                  >
                    {fmtMetric(pivot.grandTotal, pivot.metric)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {(pivot.truncatedRows > 0 || pivot.truncatedCols > 0) && (
        <Group justify="flex-end" mt="xs">
          <Badge size="xs" variant="light" color="orange">
            {pivot.truncatedRows > 0 && `${pivot.truncatedRows} filas`}
            {pivot.truncatedRows > 0 && pivot.truncatedCols > 0 && ' · '}
            {pivot.truncatedCols > 0 && `${pivot.truncatedCols} columnas`}
            {' '}sin mostrar (tope alcanzado)
          </Badge>
        </Group>
      )}

      {pivot.metric === 'margin' && (
        <Text size="xs" c="dimmed" mt="xs">
          El margen de cada celda se calcula sobre sus propios ingresos y coste agregados (no es el promedio de los márgenes).
        </Text>
      )}
    </Card>
  )
}
