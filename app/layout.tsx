import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './globals.css'
import { Inter } from 'next/font/google'
import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import { theme } from '@/lib/theme'
import 'dayjs/locale/es'

// Inter variable font — humanist, stable metrics (low CLS), great for dense data UIs.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = { title: 'Houra', description: 'Project Hour Tracker' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
            <Notifications position="bottom-left" />
            {children}
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
