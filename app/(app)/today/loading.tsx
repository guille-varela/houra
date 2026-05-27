import { Stack, Skeleton, SimpleGrid } from '@mantine/core'

/** Skeleton de Mi día — título + KPIs + lista de bloques */
export default function Loading() {
  return (
    <Stack p="md" gap="md">
      {/* Título + subtítulo */}
      <Stack gap={6}>
        <Skeleton height={26} width={220} radius="sm" />
        <Skeleton height={13} width={170} radius="sm" />
      </Stack>

      {/* KPI row */}
      <SimpleGrid cols={3} spacing="sm">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={80} radius="md" />
        ))}
      </SimpleGrid>

      {/* Bloques de tiempo */}
      <Stack gap="xs">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={62} radius="md" />
        ))}
      </Stack>
    </Stack>
  )
}
