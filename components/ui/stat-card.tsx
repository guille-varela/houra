import { Card, Text } from '@mantine/core'

/**
 * KPI / stat card — canonical "big number" card.
 * Replaces the inline `fontSize:'1.75rem'…` block repeated across the dashboard.
 */
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card p="md">
      <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Text>
      {sub && (
        <Text size="xs" c="dimmed" mt={2}>
          {sub}
        </Text>
      )}
    </Card>
  )
}
