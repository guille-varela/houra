'use client'

import { LineChart } from '@mantine/charts'
import { Text } from '@mantine/core'

/** Punto de datos semanal para la gráfica de burn rate */
type WeekPoint = {
  /** Etiqueta de la semana en formato legible (p. ej. "2024-W12") */
  week: string
  /** Horas imputadas durante esa semana */
  hours: number
  /** Horas acumuladas hasta esa semana */
  cumulative: number
}

/** Propiedades del componente BurnRateChart */
type Props = {
  /** Serie de puntos semanales que alimentan la gráfica */
  data: WeekPoint[]
}

/** Gráfica de línea que muestra la evolución acumulada de horas consumidas por semana */
export default function BurnRateChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Sin datos de consumo todavía.
      </Text>
    )
  }

  return (
    <LineChart
      h={200}
      data={data}
      dataKey="week"
      series={[{ name: 'cumulative', label: 'Horas acumuladas', color: 'gray.6' }]}
      curveType="monotone"
      withDots={data.length <= 12}
      xAxisLabel="Semana"
      yAxisLabel="Horas"
      gridAxis="y"
    />
  )
}
