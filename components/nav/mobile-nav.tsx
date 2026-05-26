'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Group, UnstyledButton, Text } from '@mantine/core'
import {
  IconSun,
  IconCalendarWeek,
  IconFolders,
  IconUmbrella,
  IconSettings,
} from '@tabler/icons-react'

type NavItem = { href: string; label: string; Icon: React.ComponentType<{ size: number; stroke: number; color: string; style: React.CSSProperties }> }

const CONTRIBUTOR_NAV: NavItem[] = [
  { href: '/today', label: 'Mi día', Icon: IconSun },
  { href: '/week', label: 'Semana', Icon: IconCalendarWeek },
  { href: '/my-projects', label: 'Proyectos', Icon: IconFolders },
  { href: '/time-off', label: 'Libre', Icon: IconUmbrella },
]

const MANAGER_NAV: NavItem[] = [
  { href: '/today', label: 'Mi día', Icon: IconSun },
  { href: '/week', label: 'Semana', Icon: IconCalendarWeek },
  { href: '/projects', label: 'Proyectos', Icon: IconFolders },
  { href: '/settings', label: 'Configuración', Icon: IconSettings },
]

type Props = { appRole: string }

export default function MobileNav({ appRole }: Props) {
  const pathname = usePathname()
  const items = appRole === 'contributor' ? CONTRIBUTOR_NAV : MANAGER_NAV

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: '1px solid var(--mantine-color-gray-2)',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 100,
      }}
    >
      <Group grow h={60} px="xs">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/today' && pathname.startsWith(href))
          return (
            <UnstyledButton
              key={href}
              component={Link}
              href={href}
              style={{ textAlign: 'center', padding: '6px 0' }}
            >
              <Icon
                size={20}
                stroke={active ? 2 : 1.5}
                color={active ? 'var(--mantine-color-dark-9)' : 'var(--mantine-color-gray-5)'}
                style={{ display: 'block', margin: '0 auto 2px' }}
              />
              <Text
                size="xs"
                fw={active ? 600 : 400}
                c={active ? 'dark.9' : 'dimmed'}
                style={{ lineHeight: 1 }}
              >
                {label}
              </Text>
            </UnstyledButton>
          )
        })}
      </Group>
    </nav>
  )
}
