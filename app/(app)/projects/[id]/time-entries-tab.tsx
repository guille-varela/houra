import { eq, desc } from 'drizzle-orm'
import { Stack, Table, TableThead, TableTbody, TableTr, TableTh, TableTd, Text, Badge, Group, Button } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { db } from '@/lib/db'
import { persons, timeEntries } from '@/db/schema'

const AREA_LABELS: Record<string, string> = {
  ux: 'UX',
  ui: 'UI',
  research: 'Research',
}

type Props = { projectId: string }

export default async function TimeEntriesTab({ projectId }: Props) {
  const rows = await db
    .select({
      id: timeEntries.id,
      date: timeEntries.date,
      hours: timeEntries.hours,
      area: timeEntries.area,
      description: timeEntries.description,
      personName: persons.name,
      personRole: persons.professionalCategory,
    })
    .from(timeEntries)
    .innerJoin(persons, eq(persons.id, timeEntries.personId))
    .where(eq(timeEntries.projectId, projectId))
    .orderBy(desc(timeEntries.date))
    .limit(200)

  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        Todavía no hay entradas en este proyecto.
      </Text>
    )
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
          Últimas {rows.length} entradas
        </Text>
        <Group gap="xs">
          <Button
            component="a"
            href={`/api/export/project/${projectId}?format=csv`}
            download
            size="xs"
            variant="light"
            color="gray"
            leftSection={<IconDownload size={12} />}
          >
            CSV
          </Button>
        </Group>
      </Group>
      <Table withTableBorder withColumnBorders fz="sm">
        <TableThead>
          <TableTr>
            <TableTh>Fecha</TableTh>
            <TableTh>Persona</TableTh>
            <TableTh>Área</TableTh>
            <TableTh ta="right">Horas</TableTh>
            <TableTh>Descripción</TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map((row) => (
            <TableTr key={row.id}>
              <TableTd style={{ whiteSpace: 'nowrap' }}>{row.date}</TableTd>
              <TableTd>
                <Group gap={4}>
                  <Text size="sm">{row.personName}</Text>
                  <Badge size="xs" variant="light" color="gray">
                    {row.personRole}
                  </Badge>
                </Group>
              </TableTd>
              <TableTd>
                <Badge size="xs" variant="light" color="gray">
                  {AREA_LABELS[row.area] ?? row.area}
                </Badge>
              </TableTd>
              <TableTd ta="right">{parseFloat(row.hours).toFixed(1)}h</TableTd>
              <TableTd>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {row.description ?? '—'}
                </Text>
              </TableTd>
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </Stack>
  )
}
