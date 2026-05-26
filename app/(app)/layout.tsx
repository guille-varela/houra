import { redirect } from 'next/navigation'
import { getCurrentPerson } from '@/lib/auth-helpers'
import MobileNav from '@/components/nav/mobile-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-20">{children}</main>
      <MobileNav appRole={person.appRole} />
    </div>
  )
}
