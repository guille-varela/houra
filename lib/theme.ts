import { createTheme } from '@mantine/core'

// Wireframe mode: neutral grayscale. Sin colores de marca.
// Phase 09 aplicará los tokens de identidad visual sobre este archivo.
export const theme = createTheme({
  primaryColor: 'gray',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, monospace',
  defaultRadius: 'sm',
  components: {
    Button: {
      defaultProps: { variant: 'outline' },
    },
  },
})
