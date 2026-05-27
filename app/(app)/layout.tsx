import { redirect } from 'next/navigation'
import { getCurrentPerson } from '@/lib/auth-helpers'
import MobileNav from '@/components/nav/mobile-nav'
import AppSidebar from '@/components/nav/app-sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  return (
    <>
      {/* Desktop shell */}
      <div
        style={{
          display: 'flex',
          height: '100vh',
          background: '#f5f5f5',
          overflow: 'hidden',
        }}
        className="hidden md:flex"
      >
        <AppSidebar appRole={person.appRole} personName={person.name} />
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
              background: 'white',
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
        <MobileNav appRole={person.appRole} />
      </div>
    </>
  )
}
