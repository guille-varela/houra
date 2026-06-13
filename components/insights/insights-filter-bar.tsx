'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Group, Select, MultiSelect, Button, Text, Loader } from '@mantine/core'
import { IconFilterOff } from '@tabler/icons-react'
import type { FilterOptions } from '@/lib/insights-data'
import {
  type InsightsFilters,
  type PeriodPreset,
  type MarginBucket,
  PERIOD_PRESETS,
  PERIOD_LABELS,
  MARGIN_BUCKETS,
  MARGIN_BUCKET_LABELS,
  INSIGHTS_AREAS,
  INSIGHTS_CATEGORIES,
  INSIGHTS_STATUSES,
  AREA_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  buildInsightsQuery,
  countActiveFilters,
} from '@/lib/insights-filters'

type Props = {
  filters: InsightsFilters
  options: FilterOptions
}

export default function InsightsFilterBar({ filters, options }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function apply(next: InsightsFilters) {
    const qs = buildInsightsQuery(next)
    startTransition(() => router.push(qs ? `/insights?${qs}` : '/insights'))
  }

  function set<K extends keyof InsightsFilters>(key: K, value: InsightsFilters[K]) {
    apply({ ...filters, [key]: value })
  }

  const periodData = PERIOD_PRESETS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))
  const marginData = MARGIN_BUCKETS.map((b) => ({ value: b, label: MARGIN_BUCKET_LABELS[b] }))
  const areaData = INSIGHTS_AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] ?? a }))
  const catData = INSIGHTS_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))
  const statusData = INSIGHTS_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s }))
  const toData = (xs: Array<{ id: string; name: string }>) => xs.map((x) => ({ value: x.id, label: x.name }))

  const active = countActiveFilters(filters)
  const W = 190

  return (
    <Card p="sm" withBorder>
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Select
          label="Periodo"
          data={periodData}
          value={filters.period}
          onChange={(v) => set('period', (v as PeriodPreset) ?? 'this_year')}
          allowDeselect={false}
          w={150}
          size="xs"
        />

        {filters.period === 'custom' && (
          <>
            <div>
              <Text size="xs" fw={500} mb={2}>Desde</Text>
              <input
                type="month"
                value={filters.from}
                onChange={(e) => set('from', e.currentTarget.value)}
                style={{
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--mantine-color-gray-3)',
                  padding: '0 8px',
                  fontSize: 13,
                }}
              />
            </div>
            <div>
              <Text size="xs" fw={500} mb={2}>Hasta</Text>
              <input
                type="month"
                value={filters.to}
                onChange={(e) => set('to', e.currentTarget.value)}
                style={{
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--mantine-color-gray-3)',
                  padding: '0 8px',
                  fontSize: 13,
                }}
              />
            </div>
          </>
        )}

        <MultiSelect
          label="Cuentas"
          placeholder={filters.workspaceIds.length ? undefined : 'Todas'}
          data={toData(options.workspaces)}
          value={filters.workspaceIds}
          onChange={(v) => set('workspaceIds', v)}
          searchable
          clearable
          w={W}
          size="xs"
          maxValues={10}
        />
        <MultiSelect
          label="Clientes"
          placeholder={filters.clientIds.length ? undefined : 'Todos'}
          data={toData(options.clients)}
          value={filters.clientIds}
          onChange={(v) => set('clientIds', v)}
          searchable
          clearable
          w={W}
          size="xs"
        />
        <MultiSelect
          label="Proyectos"
          placeholder={filters.projectIds.length ? undefined : 'Todos'}
          data={toData(options.projects)}
          value={filters.projectIds}
          onChange={(v) => set('projectIds', v)}
          searchable
          clearable
          w={W}
          size="xs"
        />
        <MultiSelect
          label="Personas"
          placeholder={filters.personIds.length ? undefined : 'Todas'}
          data={toData(options.people)}
          value={filters.personIds}
          onChange={(v) => set('personIds', v)}
          searchable
          clearable
          w={W}
          size="xs"
        />
        <MultiSelect
          label="Categoría"
          placeholder={filters.categories.length ? undefined : 'Todas'}
          data={catData}
          value={filters.categories}
          onChange={(v) => set('categories', v)}
          clearable
          w={150}
          size="xs"
        />
        <MultiSelect
          label="Área"
          placeholder={filters.areas.length ? undefined : 'Todas'}
          data={areaData}
          value={filters.areas}
          onChange={(v) => set('areas', v)}
          clearable
          w={140}
          size="xs"
        />
        <MultiSelect
          label="Estado"
          placeholder={filters.statuses.length ? undefined : 'Todos'}
          data={statusData}
          value={filters.statuses}
          onChange={(v) => set('statuses', v)}
          clearable
          w={150}
          size="xs"
        />
        <Select
          label="Margen"
          placeholder="Cualquiera"
          data={marginData}
          value={filters.marginBucket}
          onChange={(v) => set('marginBucket', (v as MarginBucket) || null)}
          clearable
          w={130}
          size="xs"
        />

        {active > 0 && (
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            leftSection={<IconFilterOff size={14} />}
            onClick={() => apply({ ...filters, ...EMPTY_DIMS })}
          >
            Limpiar ({active})
          </Button>
        )}
        {isPending && <Loader size="xs" />}
      </Group>
    </Card>
  )
}

const EMPTY_DIMS = {
  clientIds: [],
  workspaceIds: [],
  projectIds: [],
  personIds: [],
  categories: [],
  areas: [],
  statuses: [],
  marginBucket: null,
} satisfies Partial<InsightsFilters>
