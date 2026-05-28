'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tooltip, UnstyledButton } from '@mantine/core'
import {
  IconSun,
  IconCalendarWeek,
  IconFolders,
  IconUmbrella,
  IconLayoutDashboard,
  IconBriefcase,
  IconUsers,
  IconSettings,
} from '@tabler/icons-react'

/** Elemento de navegación de la barra lateral */
type NavItem = {
  /** Ruta de destino del enlace */
  href: string
  /** Etiqueta visible en el tooltip */
  label: string
  /** Componente de icono de Tabler */
  Icon: React.ComponentType<{ size: number; strokeWidth: number; style?: React.CSSProperties }>
  /** Roles que pueden ver este ítem; si se omite, es visible para todos */
  roles?: string[]
  /** Si es true, la ruta debe coincidir exactamente para marcar el ítem como activo */
  exact?: boolean
}

const NAV_TOP: NavItem[] = [
  { href: '/today', label: 'Mi día', Icon: IconSun, exact: true },
  { href: '/week', label: 'Semana', Icon: IconCalendarWeek, exact: true },
  { href: '/my-projects', label: 'Mis proyectos', Icon: IconFolders, roles: ['contributor'] },
  { href: '/projects', label: 'Proyectos', Icon: IconFolders, roles: ['admin', 'manager'] },
  { href: '/dashboard', label: 'Dashboard', Icon: IconLayoutDashboard, roles: ['admin', 'manager'] },
  { href: '/workspaces', label: 'Workspaces', Icon: IconBriefcase, roles: ['admin', 'manager'] },
  { href: '/people', label: 'Personas', Icon: IconUsers, roles: ['admin'] },
  { href: '/time-off', label: 'Libre', Icon: IconUmbrella },
]

const NAV_BOTTOM: NavItem[] = [
  { href: '/settings', label: 'Configuración', Icon: IconSettings, roles: ['admin'] },
]

/** Propiedades del componente AppSidebar */
type Props = {
  /** Rol del usuario en la aplicación, determina los ítems visibles */
  appRole: string
  /** Nombre completo de la persona, usado para el monograma de usuario */
  personName: string
}

function NavBtn({
  item,
  active,
}: {
  item: NavItem
  active: boolean
}) {
  return (
    <Tooltip label={item.label} position="right" withArrow offset={10} fz="xs">
      <UnstyledButton
        component={Link}
        href={item.href}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? '#EEF2FA' : 'transparent',
          transition: 'background 0.1s',
          flexShrink: 0,
        }}
      >
        <item.Icon
          size={18}
          strokeWidth={active ? 2 : 1.5}
          style={{ color: active ? '#111111' : '#9A9A9A' }}
        />
      </UnstyledButton>
    </Tooltip>
  )
}

function Monogram({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: '#111',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.5,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

/** Barra lateral de navegación vertical de escritorio con ítems filtrados por rol */
export default function AppSidebar({ appRole, personName }: Props) {
  const pathname = usePathname()

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  function visible(item: NavItem) {
    if (!item.roles) return true
    return item.roles.includes(appRole)
  }

  const topItems = NAV_TOP.filter(visible)
  const bottomItems = NAV_BOTTOM.filter(visible)

  return (
    <aside
      style={{
        width: 60,
        flexShrink: 0,
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 16,
        gap: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: '#111111',
            fontFamily: 'var(--font-dm-sans, system-ui)',
          }}
        >
          H
        </span>
      </div>

      {/* Top nav items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          flex: 1,
        }}
      >
        {topItems.map((item) => (
          <NavBtn key={item.href} item={item} active={isActive(item)} />
        ))}
      </div>

      {/* Bottom: settings + user */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {bottomItems.map((item) => (
          <NavBtn key={item.href} item={item} active={isActive(item)} />
        ))}
        <Tooltip label={personName} position="right" withArrow offset={10} fz="xs">
          <div style={{ cursor: 'default' }}>
            <Monogram name={personName} />
          </div>
        </Tooltip>
      </div>
    </aside>
  )
}
