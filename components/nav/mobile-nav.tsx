'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Group, UnstyledButton, Text } from '@mantine/core'

const NAV_ITEMS = [
  { href: '/today', label: 'Mi día' },
  { href: '/week', label: 'Semana' },
  { href: '/my-projects', label: 'Proyectos' },
  { href: '/time-off', label: 'Libre' },
] as const

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-white)',
        zIndex: 100,
      }}
    >
      <Group grow h={64} px="sm">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <UnstyledButton
              key={item.href}
              component={Link}
              href={item.href}
              style={{ textAlign: 'center' }}
            >
              <Text size="xs" fw={active ? 700 : 400} c={active ? 'dark' : 'dimmed'}>
                {item.label}
              </Text>
            </UnstyledButton>
          )
        })}
      </Group>
    </nav>
  )
}
