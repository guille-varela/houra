'use client'

import { Tabs } from '@mantine/core'

type Props = {
  defaultTab?: string
  summary: React.ReactNode
  staffing: React.ReactNode
  settings: React.ReactNode
}

export default function ProposalTabs({ defaultTab = 'summary', summary, staffing, settings }: Props) {
  return (
    <Tabs defaultValue={defaultTab} keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="summary">Resumen</Tabs.Tab>
        <Tabs.Tab value="staffing">Fases y equipo</Tabs.Tab>
        <Tabs.Tab value="settings">Ajustes</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="summary" pt="md">{summary}</Tabs.Panel>
      <Tabs.Panel value="staffing" pt="md">{staffing}</Tabs.Panel>
      <Tabs.Panel value="settings" pt="md">{settings}</Tabs.Panel>
    </Tabs>
  )
}
