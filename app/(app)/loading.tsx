import { Stack, Skeleton } from '@mantine/core'

/** Skeleton genérico para rutas (app) sin loading específico */
export default function Loading() {
  return (
    <Stack p="md" gap="md">
      <Skeleton height={28} width={200} radius="sm" />
      <Skeleton height={14} width={140} radius="sm" />
      <Stack gap="sm" mt="xs">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={58} radius="md" />
        ))}
      </Stack>
    </Stack>
  )
}
