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

// Geometría del SVG (viewBox; el contenedor escala de forma responsive).
const W = 600
const H = 200
const PAD = { top: 12, right: 16, bottom: 28, left: 44 }
const GRID_LINES = 4

/**
 * Gráfica de línea (SVG ligero, sin dependencias) que muestra la evolución
 * acumulada de horas consumidas por semana. Sustituye a `@mantine/charts`
 * para reducir el tamaño del bundle del Worker (límite de 3 MiB en Cloudflare).
 */
export default function BurnRateChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Sin datos de consumo todavía.
      </Text>
    )
  }

  const maxY = Math.max(...data.map((d) => d.cumulative), 1)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const x = (i: number) =>
    PAD.left + (data.length === 1 ? innerW / 2 : (innerW * i) / (data.length - 1))
  const y = (v: number) => PAD.top + innerH * (1 - v / maxY)

  const points = data.map((d, i) => ({ px: x(i), py: y(d.cumulative) }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1]!.px.toFixed(1)} ${y(0).toFixed(1)} L ${points[0]!.px.toFixed(1)} ${y(0).toFixed(1)} Z`

  // Marcas del eje Y (horas) distribuidas uniformemente de 0 a maxY.
  const yTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) => (maxY * i) / GRID_LINES)
  const showDots = data.length <= 12

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 200, overflow: 'visible' }}
      role="img"
      aria-label="Horas acumuladas por semana"
    >
      {/* Grid horizontal + etiquetas del eje Y */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--h-border, #e5e5e5)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t) + 3}
            textAnchor="end"
            fontSize={10}
            fill="var(--h-text-dimmed, #999)"
          >
            {Math.round(t)}
          </text>
        </g>
      ))}

      {/* Área bajo la línea */}
      <path d={areaPath} fill="var(--h-text, #555)" fillOpacity={0.06} />

      {/* Línea acumulada */}
      <path
        d={linePath}
        fill="none"
        stroke="var(--h-text, #555)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Puntos (solo con pocas semanas) */}
      {showDots &&
        points.map((p, i) => (
          <circle key={i} cx={p.px} cy={p.py} r={3} fill="var(--h-text, #555)" />
        ))}

      {/* Etiquetas del eje X: primera y última semana */}
      <text x={x(0)} y={H - 8} textAnchor="start" fontSize={10} fill="var(--h-text-dimmed, #999)">
        {data[0]!.week}
      </text>
      {data.length > 1 && (
        <text x={x(data.length - 1)} y={H - 8} textAnchor="end" fontSize={10} fill="var(--h-text-dimmed, #999)">
          {data[data.length - 1]!.week}
        </text>
      )}
    </svg>
  )
}
