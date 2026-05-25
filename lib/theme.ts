import { createTheme, type MantineThemeOverride } from '@mantine/core'
import { MANTINE_PRIMARY } from './tokens'

// Phase 09 migration checklist:
//   1. Add custom brand color palette: colors: { brand: ['#f0...', ..., '#1a...'] }
//   2. Change MANTINE_PRIMARY in lib/tokens.ts to 'brand'
//   3. Update --h-brand-* vars in app/globals.css :root to brand palette values
//   No component files need to change.

export const theme: MantineThemeOverride = createTheme({
  primaryColor: MANTINE_PRIMARY,

  fontFamily: 'Inter, system-ui, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, monospace',

  defaultRadius: 'sm',

  components: {
    Button: {
      defaultProps: { variant: 'outline' },
    },
    ActionIcon: {
      defaultProps: { variant: 'subtle', color: 'gray' },
    },
    TextInput: {
      defaultProps: { size: 'sm' },
    },
    NumberInput: {
      defaultProps: { size: 'sm' },
    },
    Select: {
      defaultProps: { size: 'sm' },
    },
    Textarea: {
      defaultProps: { size: 'sm' },
    },
    PasswordInput: {
      defaultProps: { size: 'sm' },
    },
  },
})
