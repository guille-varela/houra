import { Stack, Skeleton, Group } from '@mantine/core'

export default function Loading() {
  return (
    <Stack p="md" gap="xl">
      <Group justify="space-between">
        <Skeleton height={26} width={200} radius="sm" />
        <Skeleton height={18} width={80} radius="sm" />
      </Group>
      <Group justify="space-between">
        <Skeleton height={30} width={200} radius="sm" />
      </Group>
      <Stack gap={0}>
        <Skeleton height={36} radius={0} mb={2} />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} height={48} radius={0} mb={1} />
        ))}
      </Stack>
    </Stack>
  )
}
