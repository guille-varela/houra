'use client'

import { Tabs } from '@mantine/core'

type Props = {
  defaultTab?: string
  isAdmin: boolean
  overview: React.ReactNode
  entries: React.ReactNode
  team: React.ReactNode
  settings: React.ReactNode
}

export default function ProjectTabs({
  defaultTab = 'overview',
  isAdmin,
  overview,
  entries,
  team,
  settings,
}: Props) {
  return (
    <Tabs defaultValue={defaultTab} keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="entries">Entradas</Tabs.Tab>
        {isAdmin && <Tabs.Tab value="team">Equipo</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="settings">Ajustes</Tabs.Tab>}
      </Tabs.List>

      <Tabs.Panel value="overview" pt="md">
        {overview}
      </Tabs.Panel>

      <Tabs.Panel value="entries" pt="md">
        {entries}
      </Tabs.Panel>

      {isAdmin && (
        <Tabs.Panel value="team" pt="md">
          {team}
        </Tabs.Panel>
      )}

      {isAdmin && (
        <Tabs.Panel value="settings" pt="md">
          {settings}
        </Tabs.Panel>
      )}
    </Tabs>
  )
}
