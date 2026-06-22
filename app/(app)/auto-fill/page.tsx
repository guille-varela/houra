import { redirect } from 'next/navigation'
import { Stack, Text } from '@mantine/core'
import { getCurrentPerson } from '@/lib/auth-helpers'
import { getConfigurableAssignments } from '@/lib/auto-fill-data'
import AutoFillClient from '@/components/auto-fill/auto-fill-client'

export const dynamic = 'force-dynamic'

export default async function AutoFillPage() {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  // Autorellenar horas de otros → solo manager/admin.
  if (!['admin', 'manager'].includes(person.appRole)) redirect('/today')

  const assignments = await getConfigurableAssignments(person.organizationId)

  const projectMap = new Map<string, string>()
  for (const a of assignments) projectMap.set(a.projectId, a.projectName)
  const projects = [...projectMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Stack p="md" gap="lg">
      <div>
        <Text style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
          Autorellenar horas
        </Text>
        <Text size="xs" c="dimmed">
          Reparte la dedicación pactada (% o cuota mensual) en imputaciones diarias, respetando
          festivos, vacaciones y lo ya imputado a mano. Siempre con preview antes de confirmar.
        </Text>
      </div>
      <AutoFillClient assignments={assignments} projects={projects} />
    </Stack>
  )
}
