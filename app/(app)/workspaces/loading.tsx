import { Stack, Skeleton } from '@mantine/core'

export default function Loading() {
  return (
    <Stack p="md" gap="md">
      <Skeleton height={28} width={160} radius="sm" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height={78} radius="md" />
      ))}
    </Stack>
  )
}
