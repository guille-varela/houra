import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './globals.css'
import { Inter, Encode_Sans_Expanded, Roboto, DM_Sans } from 'next/font/google'
import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { theme } from '@/lib/theme'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const encodeSans = Encode_Sans_Expanded({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-encode-sans',
  display: 'swap',
})

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata = { title: 'Houra', description: 'Project Hour Tracker' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${encodeSans.variable} ${roboto.variable} ${dmSans.variable}`}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications />
          {children}
        </MantineProvider>
      </body>
    </html>
  )
}
