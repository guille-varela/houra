import { Stack, Skeleton } from '@mantine/core'

/** Skeleton de dashboard — título + bloques de workspace con filas de proyecto */
export default function Loading() {
  return (
    <Stack p="md" gap="xl">
      <Skeleton height={28} width={160} radius="sm" />

      {[0, 1].map((w) => (
        <Stack key={w} gap="sm">
          <Skeleton height={18} width={130} radius="sm" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={78} radius="md" />
          ))}
        </Stack>
      ))}
    </Stack>
  )
}
