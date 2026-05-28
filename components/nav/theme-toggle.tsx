'use client'

import { useMantineColorScheme, UnstyledButton, Tooltip } from '@mantine/core'
import { IconSun, IconMoon } from '@tabler/icons-react'

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <Tooltip label={isDark ? 'Modo claro' : 'Modo oscuro'} position="right" withArrow offset={10} fz="xs">
      <UnstyledButton
        onClick={toggleColorScheme}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          transition: 'background 0.1s',
          flexShrink: 0,
        }}
      >
        {isDark
          ? <IconSun size={16} strokeWidth={1.5} style={{ color: 'var(--h-text-subtle)' }} />
          : <IconMoon size={16} strokeWidth={1.5} style={{ color: 'var(--h-text-disabled)' }} />
        }
      </UnstyledButton>
    </Tooltip>
  )
}
