export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Nav lateral — Phase 01 */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
