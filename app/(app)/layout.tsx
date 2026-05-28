import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getCurrentPerson } from '@/lib/auth-helpers'
import MobileNav from '@/components/nav/mobile-nav'
import AppSidebar from '@/components/nav/app-sidebar'
import CommandPalette from '@/components/search/command-palette'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  const cookieStore = await cookies()
  const previewRole = person.appRole === 'admin'
    ? (cookieStore.get('_h_preview_role')?.value ?? 'admin')
    : person.appRole
  const displayRole = ['admin', 'manager', 'contributor'].includes(previewRole)
    ? previewRole
    : person.appRole

  return (
    <>
      {/* Desktop shell */}
      <div
        style={{
          display: 'flex',
          height: '100vh',
          background: 'var(--h-surface)',
          overflow: 'hidden',
        }}
        className="hidden md:flex"
      >
        <AppSidebar appRole={person.appRole} displayRole={displayRole} personName={person.name} />
        <div
          style={{
            flex: 1,
            padding: 8,
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <main
            style={{
              flex: 1,
              background: 'var(--h-surface-raised)',
              borderRadius: 14,
              overflowY: 'auto',
            }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile shell */}
      <div className="flex flex-col min-h-screen md:hidden">
        <main className="flex-1 pb-20">{children}</main>
        <MobileNav appRole={displayRole} />
      </div>

      <CommandPalette />
    </>
  )
}
