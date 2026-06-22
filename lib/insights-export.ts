/**
 * F3.5 Ola 3 — Export de Insights a CSV.
 *
 * Módulo PURO (sin DOM ni `db`): construye el string CSV a partir de un PivotResult.
 * La descarga (Blob/anchor) la hace el client component. Mismo estilo que las rutas
 * `app/api/export/*`: BOM UTF-8 + todos los campos entrecomillados (Excel respeta los
 * acentos y no rompe con comas/saltos de línea dentro de las celdas).
 */
import type { PivotResult } from './insights-data'
import { PIVOT_DIM_LABELS, PIVOT_METRIC_LABELS, type PivotMetric } from './insights-filters'

const BOM = '﻿'

function escapeCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

/**
 * Valor numérico para el CSV (sin símbolos ni locale: punto decimal, como las rutas
 * de export existentes). Los importes van en euros (los datos llegan en céntimos).
 * `null` → celda vacía para que Excel la trate como hueco, no como texto.
 */
function csvValue(v: number | null, metric: PivotMetric): string {
  if (v === null) return ''
  if (metric === 'hours') return (Math.round(v * 100) / 100).toString()
  if (metric === 'margin') return (Math.round(v * 10) / 10).toString()
  // revenue | cost en céntimos → euros con 2 decimales
  return (v / 100).toFixed(2)
}

/** Construye el contenido CSV de una tabla pivote (incluye fila/columna de totales). */
export function pivotToCsv(pivot: PivotResult): string {
  const metricLabel = PIVOT_METRIC_LABELS[pivot.metric]
  const hasCols = pivot.colDim !== 'none'

  // Cabecera: [dimensión de filas] [columnas... | métrica si no hay columnas] [Total]
  const headerCells: string[] = [PIVOT_DIM_LABELS[pivot.rowDim]]
  if (hasCols) {
    for (const c of pivot.colHeaders) headerCells.push(c.label)
    headerCells.push('Total')
  } else {
    headerCells.push(metricLabel)
  }
  const lines: string[] = [headerCells.map(escapeCell).join(',')]

  // Filas de datos.
  for (const row of pivot.rows) {
    const cells: string[] = [escapeCell(row.label)]
    if (hasCols) {
      for (const v of row.cells) cells.push(escapeCell(csvValue(v, pivot.metric)))
      cells.push(escapeCell(csvValue(row.total, pivot.metric)))
    } else {
      cells.push(escapeCell(csvValue(row.total, pivot.metric)))
    }
    lines.push(cells.join(','))
  }

  // Fila de totales.
  const totalCells: string[] = [escapeCell('Total')]
  if (hasCols) {
    for (const v of pivot.colTotals) totalCells.push(escapeCell(csvValue(v, pivot.metric)))
    totalCells.push(escapeCell(csvValue(pivot.grandTotal, pivot.metric)))
  } else {
    totalCells.push(escapeCell(csvValue(pivot.grandTotal, pivot.metric)))
  }
  lines.push(totalCells.join(','))

  return BOM + lines.join('\n')
}

/** Nombre de archivo seguro tipo `insights_pivote_ingresos_2026-06-22.csv`. */
export function pivotCsvFilename(pivot: PivotResult, isoDate: string): string {
  const parts = ['insights', 'pivote', pivot.metric]
  return `${parts.join('_')}_${isoDate}.csv`
}
