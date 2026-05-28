import { redirect } from 'next/navigation'
import { getCurrentPerson } from '@/lib/auth-helpers'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const person = await getCurrentPerson()
  if (!person) redirect('/login')
  return <>{children}</>
}
