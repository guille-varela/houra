'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Group, Select, Button, Text } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'

type Props = {
  page: number
  totalPages: number
  entityFilter: string | null
  entityOptions: { value: string; label: string }[]
}

export default function AuditPagination({ page, totalPages, entityFilter, entityOptions }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(newPage: number, entity: string | null) {
    const params = new URLSearchParams()
    if (newPage > 1) params.set('page', String(newPage))
    if (entity) params.set('entity', entity)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleEntityChange(value: string | null) {
    navigate(1, value || null)
  }

  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="sm">
      <Select
        size="xs"
        placeholder="Filtrar por tipo..."
        data={entityOptions}
        value={entityFilter ?? ''}
        onChange={handleEntityChange}
        clearable
        style={{ width: 200 }}
      />
      {totalPages > 1 && (
        <Group gap="xs" align="center">
          <Button
            size="xs"
            variant="light"
            color="gray"
            leftSection={<IconChevronLeft size={13} />}
            disabled={page <= 1}
            onClick={() => navigate(page - 1, entityFilter)}
          >
            Anterior
          </Button>
          <Text size="xs" c="dimmed">{page} / {totalPages}</Text>
          <Button
            size="xs"
            variant="light"
            color="gray"
            rightSection={<IconChevronRight size={13} />}
            disabled={page >= totalPages}
            onClick={() => navigate(page + 1, entityFilter)}
          >
            Siguiente
          </Button>
        </Group>
      )}
    </Group>
  )
}
