'use client'

import Link from 'next/link'
import { Group, Text, Badge, Stack } from '@mantine/core'
import { IconFolders, IconChevronRight } from '@tabler/icons-react'

const BILLING_LABELS: Record<string, string> = {
  hour_bag: 'Bolsa horas',
  monthly_fee: 'Fee mensual',
  by_phase: 'Por entregable',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'gray' },
  active: { label: 'Activo', color: 'green' },
  paused: { label: 'Pausado', color: 'orange' },
  closed: { label: 'Cerrado', color: 'red' },
}

type Project = {
  id: string
  name: string
  status: string
  billingModel: string
}

export default function ClientProjectsTab({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <Stack align="center" gap="sm" py={48}>
        <IconFolders size={32} strokeWidth={1} style={{ color: 'var(--h-text-disabled)' }} />
        <Text size="sm" c="dimmed">No hay proyectos asignados a este cliente</Text>
        <Text size="xs" c="dimmed">Asigna un cliente desde la configuración de cada proyecto</Text>
      </Stack>
    )
  }

  return (
    <Stack gap={4}>
      {projects.map((project) => {
        const statusMeta = STATUS_LABELS[project.status] ?? { label: project.status, color: 'gray' }
        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <Group
              justify="space-between"
              align="center"
              p="sm"
              style={{
                borderRadius: 10,
                border: '1px solid var(--h-border)',
                background: 'var(--h-surface-raised)',
                cursor: 'pointer',
              }}
            >
              <Group gap="sm">
                <IconFolders size={15} strokeWidth={1.5} style={{ color: 'var(--h-text-disabled)', flexShrink: 0 }} />
                <Text size="sm" fw={500} style={{ color: 'var(--h-text)' }}>{project.name}</Text>
                <Badge size="xs" variant="light" color="gray">
                  {BILLING_LABELS[project.billingModel] ?? project.billingModel}
                </Badge>
              </Group>
              <Group gap="sm">
                <Badge size="xs" variant="light" color={statusMeta.color}>{statusMeta.label}</Badge>
                <IconChevronRight size={14} style={{ color: 'var(--h-text-disabled)' }} />
              </Group>
            </Group>
          </Link>
        )
      })}
    </Stack>
  )
}
