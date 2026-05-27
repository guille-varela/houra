import { Stack, Skeleton, Group } from '@mantine/core'

export default function Loading() {
  return (
    <Stack p="md" gap="md">
      <Stack gap={6}>
        <Skeleton height={26} width={200} radius="sm" />
        <Skeleton height={13} width={100} radius="sm" />
      </Stack>
      <Group gap="xs">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={32} width={80} radius="sm" />
        ))}
      </Group>
      <Stack gap="sm" mt="xs">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={78} radius="md" />
        ))}
      </Stack>
    </Stack>
  )
}
