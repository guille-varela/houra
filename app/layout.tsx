import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './globals.css'
import { DM_Sans } from 'next/font/google'
import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import { theme } from '@/lib/theme'
import 'dayjs/locale/es'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata = { title: 'Houra', description: 'Project Hour Tracker' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={dmSans.variable}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, weekendDays: [0, 6] }}>
            <Notifications />
            {children}
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
