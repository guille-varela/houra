'use client'

import { Tabs } from '@mantine/core'

type Props = {
  defaultTab?: string
  isAdmin: boolean
  isManager: boolean
  overview: React.ReactNode
  entries: React.ReactNode
  margin: React.ReactNode
  amendments: React.ReactNode
  share: React.ReactNode
  team: React.ReactNode
  settings: React.ReactNode
}

export default function ProjectTabs({
  defaultTab = 'overview',
  isAdmin,
  isManager,
  overview,
  entries,
  margin,
  amendments,
  share,
  team,
  settings,
}: Props) {
  return (
    <Tabs defaultValue={defaultTab} keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="entries">Entradas</Tabs.Tab>
        {isManager && <Tabs.Tab value="margin">Margen</Tabs.Tab>}
        {isManager && <Tabs.Tab value="amendments">Amendments</Tabs.Tab>}
        {isManager && <Tabs.Tab value="share">Compartir</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="team">Equipo</Tabs.Tab>}
        {isAdmin && <Tabs.Tab value="settings">Ajustes</Tabs.Tab>}
      </Tabs.List>

      <Tabs.Panel value="overview" pt="md">{overview}</Tabs.Panel>
      <Tabs.Panel value="entries" pt="md">{entries}</Tabs.Panel>

      {isManager && <Tabs.Panel value="margin" pt="md">{margin}</Tabs.Panel>}
      {isManager && <Tabs.Panel value="amendments" pt="md">{amendments}</Tabs.Panel>}
      {isManager && <Tabs.Panel value="share" pt="md">{share}</Tabs.Panel>}

      {isAdmin && <Tabs.Panel value="team" pt="md">{team}</Tabs.Panel>}
      {isAdmin && <Tabs.Panel value="settings" pt="md">{settings}</Tabs.Panel>}
    </Tabs>
  )
}
