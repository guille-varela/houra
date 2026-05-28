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

/** Elemento de navegación de la barra móvil inferior */
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

/** Propiedades del componente MobileNav */
type Props = {
  /** Rol del usuario; determina si se muestra la navegación de contributor o de manager */
  appRole: string
}

/** Barra de navegación inferior fija para dispositivos móviles, adaptada al rol del usuario */
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
        borderTop: '1px solid var(--h-border)',
        background: 'var(--h-surface-raised)',
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
                color={active ? 'var(--h-text)' : 'var(--h-text-disabled)'}
                style={{ display: 'block', margin: '0 auto 2px' }}
              />
              <Text
                size="xs"
                fw={active ? 600 : 400}
                style={{ lineHeight: 1, color: active ? 'var(--h-text)' : 'var(--h-text-disabled)' }}
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
