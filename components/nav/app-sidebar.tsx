'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UnstyledButton, Tooltip } from '@mantine/core'
import {
  IconSun,
  IconCalendarWeek,
  IconFolders,
  IconUmbrella,
  IconLayoutDashboard,
  IconBriefcase,
  IconUsers,
  IconBuilding,
  IconSettings,
  IconCommand,
  IconFileText,
  IconBeach,
  IconChartHistogram,
} from '@tabler/icons-react'
import RoleSwitcher from './role-switcher'
import ThemeToggle from './theme-toggle'

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('houra:search'))
}

type NavItem = {
  href: string
  label: string
  Icon: React.ComponentType<{ size: number; strokeWidth: number; style?: React.CSSProperties }>
  roles?: string[]
  exact?: boolean
  insights?: boolean
}

const NAV_TOP: NavItem[] = [
  { href: '/today', label: 'Mi día', Icon: IconSun, exact: true },
  { href: '/week', label: 'Semana', Icon: IconCalendarWeek, exact: true },
  { href: '/my-projects', label: 'Mis proyectos', Icon: IconFolders, roles: ['contributor'] },
  { href: '/projects', label: 'Proyectos', Icon: IconFolders, roles: ['admin', 'manager'] },
  { href: '/dashboard', label: 'Dashboard', Icon: IconLayoutDashboard, roles: ['admin', 'manager'] },
  { href: '/insights', label: 'Insights', Icon: IconChartHistogram, insights: true },
  { href: '/workspaces', label: 'Cuentas', Icon: IconBriefcase, roles: ['admin', 'manager'] },
  { href: '/proposals', label: 'Propuestas', Icon: IconFileText, roles: ['admin', 'manager'] },
  { href: '/clients', label: 'Clientes', Icon: IconBuilding, roles: ['admin', 'manager'] },
  { href: '/people', label: 'Personas', Icon: IconUsers, roles: ['admin'] },
  { href: '/time-off', label: 'Libre', Icon: IconUmbrella },
  { href: '/vacaciones', label: 'Vacaciones', Icon: IconBeach },
]

const NAV_BOTTOM: NavItem[] = [
  { href: '/settings', label: 'Configuración', Icon: IconSettings, roles: ['admin'] },
]

type Props = {
  appRole: string
  displayRole: string
  personName: string
  canSeeInsights: boolean
}

function NavBtn({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <UnstyledButton
      component={Link}
      href={item.href}
      style={{
        width: '100%',
        height: 34,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 10px',
        background: active ? 'var(--h-surface-subtle)' : 'transparent',
        transition: 'background 0.1s',
        flexShrink: 0,
      }}
    >
      <item.Icon
        size={16}
        strokeWidth={active ? 2 : 1.5}
        style={{ color: active ? 'var(--h-text)' : 'var(--h-text-disabled)', flexShrink: 0 }}
      />
      <span style={{
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--h-text)' : 'var(--h-text-subtle)',
        letterSpacing: '-0.01em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {item.label}
      </span>
    </UnstyledButton>
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
        width: 26,
        height: 26,
        borderRadius: 7,
        background: 'var(--h-text)',
        color: 'var(--h-text-inverse)',
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

export default function AppSidebar({ appRole, displayRole, personName, canSeeInsights }: Props) {
  const pathname = usePathname()

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  function visible(item: NavItem) {
    if (item.insights) return canSeeInsights
    if (!item.roles) return true
    return item.roles.includes(displayRole)
  }

  const topItems = NAV_TOP.filter(visible)
  const bottomItems = NAV_BOTTOM.filter(visible)
  const shortName = personName.split(' ').slice(0, 2).join(' ')

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--h-surface-raised)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        borderRight: '1px solid var(--h-border)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '0 4px' }}>
        <div style={{
          width: 24,
          height: 24,
          background: 'var(--h-text)',
          color: 'var(--h-text-inverse)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          flexShrink: 0,
          fontFamily: 'var(--font-dm-sans, system-ui)',
        }}>
          H
        </div>
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: 'var(--h-text)',
          fontFamily: 'var(--font-dm-sans, system-ui)',
        }}>
          houra
        </span>
      </div>

      {/* Search shortcut */}
      <UnstyledButton
        onClick={openCommandPalette}
        style={{
          width: '100%',
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          background: 'var(--h-surface-subtle)',
          border: '1px solid var(--h-border)',
          marginBottom: 12,
          cursor: 'text',
        }}
      >
        <IconCommand size={13} strokeWidth={1.5} style={{ color: 'var(--h-text-disabled)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--h-text-disabled)', flex: 1 }}>Buscar…</span>
        <span style={{
          fontSize: 10,
          color: 'var(--h-text-disabled)',
          background: 'var(--h-surface-raised)',
          border: '1px solid var(--h-border)',
          borderRadius: 4,
          padding: '1px 5px',
          letterSpacing: '0.02em',
        }}>⌘K</span>
      </UnstyledButton>

      {/* Top nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {topItems.map((item) => (
          <NavBtn key={item.href} item={item} active={isActive(item)} />
        ))}
      </div>

      {/* Bottom section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {bottomItems.map((item) => (
          <NavBtn key={item.href} item={item} active={isActive(item)} />
        ))}

        {appRole === 'admin' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <RoleSwitcher currentDisplay={displayRole} actualRole={appRole} />
            <span style={{ fontSize: 12, color: 'var(--h-text-disabled)' }}>
              {displayRole !== appRole ? `Vista: ${displayRole}` : 'Ver como…'}
            </span>
          </div>
        )}

        <div style={{ height: 1, background: 'var(--h-border)', margin: '6px 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
          <Tooltip label={personName} position="right" withArrow offset={10} fz="xs">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'default' }}>
              <Monogram name={personName} />
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--h-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {shortName}
              </span>
            </div>
          </Tooltip>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
