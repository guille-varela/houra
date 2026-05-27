import { Stack, Skeleton, SimpleGrid } from '@mantine/core'

/** Skeleton de lista de proyectos — título + grid de cards */
export default function Loading() {
  return (
    <Stack p="md" gap="xl">
      <Skeleton height={28} width={140} radius="sm" />

      <Stack gap="sm">
        <Skeleton height={12} width={56} radius="sm" />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={118} radius="md" />
          ))}
        </SimpleGrid>
      </Stack>
    </Stack>
  )
}
