import { Stack, Skeleton, Group } from '@mantine/core'

/** Skeleton de detalle de proyecto — título + tabs + contenido */
export default function Loading() {
  return (
    <Stack p="md" gap="md">
      {/* Nombre + estado */}
      <Stack gap={6}>
        <Skeleton height={26} width={240} radius="sm" />
        <Skeleton height={13} width={100} radius="sm" />
      </Stack>

      {/* Tabs */}
      <Group gap="xs">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={32} width={76} radius="sm" />
        ))}
      </Group>

      {/* Contenido del tab activo */}
      <Stack gap="sm" mt="xs">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={70} radius="md" />
        ))}
      </Stack>
    </Stack>
  )
}
