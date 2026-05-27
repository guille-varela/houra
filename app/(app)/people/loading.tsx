import { Stack, Skeleton } from '@mantine/core'

export default function Loading() {
  return (
    <Stack p="md" gap="md">
      <Skeleton height={28} width={140} radius="sm" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} height={58} radius="md" />
      ))}
    </Stack>
  )
}
