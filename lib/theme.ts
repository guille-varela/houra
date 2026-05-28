import { createTheme, type MantineThemeOverride } from '@mantine/core'
import { MANTINE_PRIMARY } from './tokens'

export const theme: MantineThemeOverride = createTheme({
  primaryColor: MANTINE_PRIMARY,

  fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
  fontFamilyMonospace: 'ui-monospace, monospace',

  defaultRadius: 'lg',

  fontSizes: {
    xs: '0.6875rem',
    sm: '0.8125rem',
    md: '0.875rem',
    lg: '1rem',
    xl: '1.125rem',
  },

  lineHeights: {
    xs: '1.4',
    sm: '1.45',
    md: '1.5',
    lg: '1.55',
    xl: '1.6',
  },

  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.2' },
      h2: { fontSize: '1.375rem', lineHeight: '1.25' },
      h3: { fontSize: '1.0625rem', lineHeight: '1.3' },
      h4: { fontSize: '0.9375rem', lineHeight: '1.35' },
      h5: { fontSize: '0.8125rem', lineHeight: '1.4' },
    },
  },

  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },

  shadows: {
    xs: '0 1px 2px rgba(0,0,0,0.05)',
    sm: '0 1px 4px rgba(0,0,0,0.07)',
    md: '0 2px 8px rgba(0,0,0,0.08)',
    lg: '0 4px 16px rgba(0,0,0,0.08)',
  },

  components: {
    Button: {
      defaultProps: { variant: 'filled', color: 'dark' },
      styles: {
        root: { fontWeight: 500, letterSpacing: '-0.01em' },
      },
    },
    ActionIcon: {
      defaultProps: { variant: 'subtle', color: 'gray' },
    },
    // Cards: white, no border, shadow visible enough over #fafafa shell
    Card: {
      defaultProps: { padding: 'lg', radius: 'lg' },
      styles: {
        root: {
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
          border: 'none',
        },
      },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
      styles: {
        root: {
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
          border: 'none',
        },
      },
    },
    Badge: {
      styles: {
        root: { fontWeight: 500, letterSpacing: '0' },
      },
    },
    TextInput: {
      defaultProps: { size: 'sm', radius: 'md' },
    },
    NumberInput: {
      defaultProps: { size: 'sm', radius: 'md' },
    },
    Select: {
      defaultProps: { size: 'sm', radius: 'md' },
    },
    Textarea: {
      defaultProps: { size: 'sm', radius: 'md' },
    },
    PasswordInput: {
      defaultProps: { size: 'sm', radius: 'md' },
    },
    Divider: {
      styles: {
        root: { borderColor: 'rgba(0,0,0,0.06)' },
      },
    },
    Tabs: {
      styles: {
        tab: { fontWeight: 500, fontSize: '0.8125rem' },
      },
    },
    Modal: {
      defaultProps: { radius: 'lg' },
    },
    Drawer: {
      defaultProps: { radius: 'lg' },
    },
  },
})
