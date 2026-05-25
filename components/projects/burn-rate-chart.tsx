'use client'

import { LineChart } from '@mantine/charts'
import { Text } from '@mantine/core'

type WeekPoint = {
  week: string
  hours: number
  cumulative: number
}

type Props = {
  data: WeekPoint[]
}

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
