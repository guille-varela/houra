import { Stack, Skeleton } from '@mantine/core'

/** Skeleton de Mi semana — título + filas por día */
export default function Loading() {
  return (
    <Stack p="md" gap="lg">
      <Skeleton height={26} width={160} radius="sm" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Stack key={i} gap="xs">
          <Skeleton height={13} width={90} radius="sm" />
          <Stack gap={4}>
            <Skeleton height={54} radius="md" />
            {i < 2 && <Skeleton height={54} radius="md" />}
          </Stack>
        </Stack>
      ))}
    </Stack>
  )
}
