'use client'

import { Menu, UnstyledButton, Tooltip, Text, Group } from '@mantine/core'
import { IconEye, IconCheck, IconEyeOff } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

const ROLES: { value: string; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Vista completa' },
  { value: 'manager', label: 'Manager', description: 'Sin configuración' },
  { value: 'contributor', label: 'Contributor', description: 'Solo imputación' },
]

type Props = {
  currentDisplay: string
  actualRole: string
}

export default function RoleSwitcher({ currentDisplay, actualRole }: Props) {
  const router = useRouter()
  const isPreviewing = currentDisplay !== actualRole

  function switchRole(role: string) {
    document.cookie = `_h_preview_role=${role}; path=/; max-age=86400; SameSite=Lax`
    router.refresh()
  }

  return (
    <Menu position="right-end" withArrow offset={12} shadow="md" width={200}>
      <Menu.Target>
        <Tooltip
          label={isPreviewing ? `Previewing: ${currentDisplay}` : 'Ver como…'}
          position="right"
          withArrow
          offset={10}
          fz="xs"
        >
          <UnstyledButton
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isPreviewing ? '#EEF2FA' : 'transparent',
              transition: 'background 0.1s',
              flexShrink: 0,
            }}
          >
            {isPreviewing
              ? <IconEye size={16} style={{ color: '#3b82f6' }} />
              : <IconEyeOff size={16} style={{ color: '#9A9A9A' }} />
            }
          </UnstyledButton>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label fz="xs">Ver app como…</Menu.Label>
        {ROLES.map((role) => (
          <Menu.Item
            key={role.value}
            onClick={() => switchRole(role.value)}
            rightSection={
              currentDisplay === role.value
                ? <IconCheck size={12} style={{ color: '#3b82f6' }} />
                : null
            }
          >
            <Group gap={6} wrap="nowrap">
              <div>
                <Text size="xs" fw={currentDisplay === role.value ? 600 : 400}>
                  {role.label}
                </Text>
                <Text size="xs" c="dimmed">{role.description}</Text>
              </div>
            </Group>
          </Menu.Item>
        ))}

        {isPreviewing && (
          <>
            <Menu.Divider />
            <Menu.Item
              onClick={() => switchRole(actualRole)}
              leftSection={<IconEyeOff size={13} style={{ color: '#9A9A9A' }} />}
            >
              <Text size="xs" c="dimmed">Volver a mi rol</Text>
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
